"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ChatMessageItem } from './chat-message';
import { ChatMessage } from '../lib/types';
import { generateId } from '../lib/utils';
import { Card } from './ui/card';
import { Separator } from './ui/separator';

// Helper function for fetch with timeout with improved error handling
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 30000) => {
  try {
    const controller = new AbortController();
    const { signal } = controller;
    
    // Create a timeout promise that rejects
    const timeoutPromise = new Promise<Response>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
        timeoutError.name = 'TimeoutError'; // Add custom error type
        reject(timeoutError);
      }, timeoutMs);
    });
    
    // Race between the fetch and the timeout
    const response = await Promise.race([
      fetch(url, { ...options, signal }),
      timeoutPromise
    ]);
    
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn(`API call to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I can help you analyze China auto sales data. Ask me anything about sales by manufacturer, model, time period, or trends.',
      createdAt: new Date(),
    },
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  
  // Scroll to the bottom when messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading) return;
    
    // Add user message immediately
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputValue,
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    // Create temporary placeholder message
    const assistantMessageId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date(),
      isLoading: true,
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(true);

    try {
      // STEP 1: Generate SQL query with timeout
      const queryResponse = await fetchWithTimeout(
        '/api/chat/generate-query', 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            question: userMessage.content,
            chatHistory: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            })).slice(-6)
          })
        },
        30000 // 30 second timeout
      );
      
      if (!queryResponse.ok) throw new Error('Failed to generate query');
      const queryData = await queryResponse.json();
      
      // Update message with preliminary response
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: 'Generating SQL query...' } 
            : msg
        )
      );
      
      // STEP 2: Execute SQL with timeout
      const sqlResponse = await fetchWithTimeout(
        '/api/chat/execute-query',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sqlQuery: queryData.sqlQuery })
        },
        30000
      );
      
      if (!sqlResponse.ok) throw new Error('Failed to execute query');
      const sqlData = await sqlResponse.json();
      
      // STEP 3: Generate insights with timeout (if needed)
      let insightData = { insight: null };
      
      if (sqlData.data && sqlData.data.length > 0) {
        const insightResponse = await fetchWithTimeout(
          '/api/chat/generate-insight',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: sqlData.data,
              sqlQuery: queryData.sqlQuery,
              question: userMessage.content
            })
          },
          30000
        );
        
        if (insightResponse.ok) {
          insightData = await insightResponse.json();
        }
      }
      
      // Update final message with complete data
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === assistantMessageId 
            ? { 
                ...msg, 
                isLoading: false,
                content: queryData.content || 'Here are the results:',
                dataResult: {
                  data: sqlData.data || [],
                  sqlQuery: queryData.sqlQuery,
                  displayType: sqlData.displayType || 'table',
                  insight: insightData.insight || undefined
                }
              } 
            : msg
        )
      );
    } catch (error) {
      console.error('Error processing chat:', error);
      
      let errorMessage = 'An error occurred';
      
      if (error instanceof Error) {
        // Handle timeout specifically
        if (error.name === 'TimeoutError') {
          errorMessage = 'The request took too long to complete. Please try a simpler query or try again later.';
        } else {
          errorMessage = error.message;
        }
      }
      
      // Update message with error state
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg.id === assistantMessageId 
            ? { 
                ...msg, 
                isLoading: false,
                isError: true,
                errorMessage: errorMessage
              } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Example questions to help users get started
  const exampleQuestions = [
    'Give me the top 10 most sold models in 2024',
    'aggregates monthly sales from 2018 til now for 小米汽车，蔚来汽车，理想汽车 and 小鹏汽车. returns a row for each year and month with the sales for each manufacturer in separate columns. use model_unit_sales for aggregating sales volume in each cell',
    'Show me the monthly sales trend for 丰田 in 2019. fuzzy match on the manufacturer name',
    'Compare sales of 宝马, 奔驰, 奥迪in each year between 2018 to 2024. fuzzy match on the manufacturer name. each row should be 1 year, each column should be each of the manufacturer'
  ];

  // Add a simplified query modification handler
  const handleQueryModification = async (originalQuery: string, suggestion: string, originalData: any[]): Promise<void> => {
    // Don't allow modifications if already loading
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Add the user's suggestion as a new message
      const userMessageId = generateId();
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: `Modify query: ${suggestion}`,
        createdAt: new Date(),
      };
      
      // Add user message
      setMessages(prev => [...prev, userMessage]);
      
      // Create a placeholder for the assistant's response to the modification
      const assistantMessageId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: `Modifying query to ${suggestion}...`,
        createdAt: new Date(),
        isLoading: true,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Call the API to modify the query
      const response = await fetch('/api/chat/modify-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalQuery,
          suggestion,
          originalResults: originalData.slice(0, 5)
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to modify query');
      }
      
      const data = await response.json();
      
      // Generate insights for the modified data if not provided by the API
      let insight = data.insight || '';
      
      if (!insight && data.data && data.data.length > 0) {
        try {
          // Call the API to generate insights for the modified data
          const insightResponse = await fetch('/api/chat/generate-insight', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: data.data,
              sqlQuery: data.modifiedQuery,
              question: suggestion
            }),
          });
          
          if (insightResponse.ok) {
            const insightData = await insightResponse.json();
            insight = insightData.insight || '';
          }
        } catch (error) {
          console.error('Error generating insights:', error);
        }
      }
      
      // Update the assistant message with the modification results
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              content: `Modified query to ${suggestion}: ${data.explanation || 'Query modified successfully.'}`,
              isLoading: false,
              dataResult: {
                data: data.data || [],
                displayType: data.displayType || 'table',
                sqlQuery: data.modifiedQuery,
                insight: insight,
              },
            };
          }
          return msg;
        })
      );
    } catch (error) {
      // Handle errors during modification
      setMessages(prev => 
        prev.map(msg => {
          if (msg.isLoading) {
            return {
              ...msg,
              content: 'Sorry, there was an error modifying the query.',
              isLoading: false,
              isError: true,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            };
          }
          return msg;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-500 py-4 px-6 text-white">
        <h1 className="text-2xl font-bold">China Auto Sales Data Analyzer</h1>
        <p className="text-gray-100">Ask questions about China's auto market data since 2018</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessageItem 
            key={message.id} 
            message={message} 
            onModifyQuery={handleQueryModification}
          />
        ))}
        <div ref={endOfMessagesRef} />
      </div>
      
      {messages.length <= 1 && (
        <Card className="mx-4 my-2 p-4">
          <h3 className="font-medium mb-2">Try asking:</h3>
          <div className="grid grid-cols-1 gap-2">
            {exampleQuestions.map((question, i) => (
              <Button 
                key={i} 
                variant="outline" 
                className="justify-start h-auto py-2 px-3 text-left whitespace-normal break-words"
                onClick={() => {
                  setInputValue(question);
                }}
              >
                {question}
              </Button>
            ))}
          </div>
        </Card>
      )}
      
      <Separator />
      
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question about China auto sales data..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !inputValue.trim()}>
            {isLoading ? (
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-white animate-bounce"></span>
                <span className="h-1 w-1 rounded-full bg-white animate-bounce delay-75"></span>
                <span className="h-1 w-1 rounded-full bg-white animate-bounce delay-150"></span>
              </span>
            ) : (
              'Send'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
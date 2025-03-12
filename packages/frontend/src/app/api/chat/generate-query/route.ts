import { NextResponse } from 'next/server';
import { processQuestion } from '@/lib/openai';

export async function POST(request: Request) {
  try {
    const { question, chatHistory } = await request.json();

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Process the question to get SQL
    const response = await processQuestion({
      question,
      chatHistory: chatHistory || []
    });

    return NextResponse.json({
      sqlQuery: response.sqlQuery,
      content: response.content,
      type: response.type
    });
  } catch (error) {
    console.error('Query generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate query' },
      { status: 500 }
    );
  }
} 
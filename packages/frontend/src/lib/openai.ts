import OpenAI from 'openai';
import { fetchSchemaMetadata, SchemaMetadata } from './supabase';

// Initialize the OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ProcessQuestionProps {
  question: string;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
}

interface ProcessQuestionResult {
  type: 'follow_up' | 'sql';
  content: string;
  sqlQuery?: string;
  insightTemplate?: string;
  reasoning?: string; // Chain of thought reasoning
}

interface ColumnMetadata {
  description: string;
  data_type?: string;
}

interface TableMetadata {
  description: string;
  columns: Record<string, string>;
}

// Function to process a user's question using OpenAI
export async function processQuestion({ 
  question, 
  chatHistory 
}: ProcessQuestionProps): Promise<ProcessQuestionResult> {
  const startTime = performance.now();
  console.log('[TIMING] Starting OpenAI processing');
  
  try {
    // Fetch schema metadata from the backend
    const schemaMetadata: SchemaMetadata | null = await fetchSchemaMetadata();
    
    // Build a detailed schema description with column documentation
    let schemaDescription = '';
    if (schemaMetadata && schemaMetadata.tables) {
      Object.entries(schemaMetadata.tables).forEach(([tableName, tableInfo]) => {
        schemaDescription += `Table: ${tableName}\n`;
        schemaDescription += `Description: ${tableInfo.description}\n`;
        schemaDescription += 'Columns:\n';
        
        Object.entries(tableInfo.columns).forEach(([columnName, description]) => {
          schemaDescription += `- ${columnName}: ${description}\n`;
        });
        
        schemaDescription += '\n';
      });
    } else {
      // Fall back to the original schema description if API call fails
      schemaDescription = `Table: china_auto_sales
Columns:
- manufacturer_name (text): The name of the auto manufacturer
- month (integer): Month of the data (1-12)
- year (integer): Year of the data (2018 onwards)
- total_units_sold (integer): Total units sold by the manufacturer in that month
- model_name (text): Name of the car model
- model_units_sold (integer): Units of this specific model sold in that month`;
    }

    const messages = [
      {
        role: 'system',
        content: `You are an AI assistant that helps users query China auto sales data in a Supabase database with the following structure:
        
${schemaDescription}

For the user's question, do one of the following:
1. If the question is unclear or lacks specific details (like time period), respond with a follow-up question to clarify.
2. If the question is clear, provide:
   a. The SQL query needed to answer the question
   b. An insight template with placeholders (e.g., "The total sales of {make} in {year} were {result}, representing {percentage}% of the market.")
   c. Optional calculations for insights (e.g., percentage changes, market share)
   d. Chain of thought reasoning explaining your approach to forming the SQL query

Format your response as JSON with the following structure for follow-up questions:
{
  "type": "follow_up",
  "content": "Your follow-up question here"
}

For SQL queries:
{
  "type": "sql",
  "content": "Brief explanation of what you're going to do",
  "sqlQuery": "Your SQL query here",
  "insightTemplate": "Template with {placeholders} for results",
  "reasoning": "Detailed step-by-step chain of thought reasoning that explains how you interpreted the question and formulated the SQL query. Be thorough so users can understand your logic."
}`,
      },
      ...chatHistory,
      { role: 'user', content: question },
    ] as any;

    const response = await openai.chat.completions.create({
      model: 'o3-mini',
      messages,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content in response');
    }

    try {
      const endTime = performance.now();
      console.log(`[TIMING] OpenAI processing completed in ${endTime - startTime}ms`);
      return JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid response from OpenAI');
    }
  } catch (error) {
    const errorTime = performance.now() - startTime;
    console.error(`[TIMING] OpenAI error after ${errorTime}ms:`, error);
    throw error;
  }
}

// Function to generate insights from data results
export async function generateInsights({
  data,
  question,
  sqlQuery,
  insightTemplate,
}: {
  data: any;
  question: string;
  sqlQuery: string;
  insightTemplate: string;
}): Promise<string> {
  const startTime = performance.now();
  console.log('[TIMING] Starting OpenAI insights generation');
  
  try {
    // Generate basic statistics about the data
    const generateBasicStats = (fullData: any[]) => {
      try {
        if (!Array.isArray(fullData) || fullData.length === 0) {
          return { rowCount: 0 };
        }
        
        // Get row count
        const rowCount = fullData.length;
        
        // Get column names
        const sampleRow = fullData[0];
        const columns = Object.keys(sampleRow);
        
        return {
          rowCount,
          columns
        };
      } catch (err) {
        console.error("Error generating basic stats:", err);
        return { rowCount: Array.isArray(fullData) ? fullData.length : 0 };
      }
    };
    
    // Use the full dataset for analysis
    const dataToAnalyze = data;
    const basicStats = Array.isArray(data) ? generateBasicStats(data) : { rowCount: 0 };

    // Log warning for large datasets
    if (Array.isArray(data) && data.length > 100) {
      console.warn(`Large dataset with ${data.length} rows being sent to OpenAI. This may cause issues with token limits.`);
    }

    const prompt = insightTemplate || `
      Analyze this data thoroughly and provide concise, valuable insights about the results. 
      Focus on meaningful patterns, significant trends, noteworthy anomalies, and important findings.
      
      Format your response using proper Markdown:
      - Use # and ## for headings
      - Use bullet points (*, -) for lists
      - Use bold and italic for emphasis
      - Use tables where appropriate using Markdown table syntax
    `;

    const response = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        {
          role: 'system',
          content: `You are an elite data analyst with exceptional insight into business and market trends.
          Your analysis is thorough, insightful, and reveals non-obvious patterns in data.
          
          YOUR TASK:
          Given a dataset, analyze it thoroughly and provide comprehensive insights.
          Look for patterns, trends, outliers, and other meaningful observations.
          
          ANALYSIS APPROACH:
          
          1. Understand the data structure and context
          2. Identify key patterns and relationships in the data
          3. Highlight notable outliers or anomalies
          4. Provide actionable insights relevant to the business question
          
          FORMAT GUIDELINES:
          - Use proper Markdown formatting in your response
          - Start with a level 1 heading (# ) for the main title
          - Use level 2 headings (## ) for each section
          - Use bullet points (* or -) for key insights
          - Use bold (**text**) for important numbers or findings
          - Use tables if they help organize numerical comparisons
          - Include a brief "Summary" section at the end with key takeaways
          
          REMEMBER: Your analysis should be data-driven, comprehensive, and tailored to the specific dataset and question at hand.
          Use proper Markdown formatting for clear and structured presentation.
          `
        },
        {
          role: 'user',
          content: `
          I ran the following SQL query: ${sqlQuery}
          
          It was in response to this question: "${question}"
          
          Here is the complete dataset from the query (${basicStats.rowCount} total rows):
          ${JSON.stringify(dataToAnalyze, null, 2)}
          
          ${prompt}
          
          Please analyze this complete dataset and provide in-depth insights that would be truly valuable to a business user.
          Focus on the most significant patterns and actionable findings.
          `
        }
      ]
    });

    const insight = response.choices[0]?.message?.content || 'No insights available for this data.';
    const endTime = performance.now();
    console.log(`[TIMING] OpenAI insights generation completed in ${endTime - startTime}ms`);
    return insight;
  } catch (error: unknown) {
    const errorTime = performance.now() - startTime;
    console.error(`[TIMING] OpenAI error after ${errorTime}ms:`, error);
    
    // Check if error is related to token limits
    const errorString = String(error);
    if (errorString.includes('token') || errorString.includes('context length')) {
      return 'The dataset is too large to analyze in its entirety. Try limiting the query results or using a more focused query.';
    }
    
    return 'Failed to generate insights due to an error.';
  }
}

export default openai; 
// Define the message role types
export type MessageRole = 'user' | 'assistant' | 'system';

// Define the message data structure
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

// Define data display types for different visualizations
export type DataDisplayType = 'table' | 'bar' | 'line' | 'pie' | 'none';

// Define the data result structure
export interface DataResult {
  data: any[];
  displayType: DataDisplayType;
  insight?: string;
  sqlQuery?: string;
  reasoning?: string; // Chain of thought reasoning
  column_order?: string[]; // Column order from SQL query
  modifiedFrom?: string; // Original query if this is a modified result
  modifications?: { 
    type: string; 
    description: string;
  }[]; // List of modifications made
}

// Define the complete chat message structure
export interface ChatMessage extends Message {
  dataResult?: DataResult;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  sqlQuery?: string; // SQL query for error display
}

// Auto sales data structure based on the database schema
export interface AutoSalesData {
  manufacturer_name: string;
  month: number;
  year: number;
  total_units_sold: number;
  model_name: string;
  model_units_sold: number;
}

// Define the structure for OpenAI's response
export interface OpenAIResponse {
  type: 'follow_up' | 'sql';
  content: string;
  sqlQuery?: string;
  insightTemplate?: string;
  reasoning?: string; // Chain of thought reasoning
} 
// Common types used across frontend and backend

export type DataDisplayType = 'table' | 'bar' | 'line' | 'pie' | 'none';

export interface DataResult {
  data: Record<string, unknown>[];
  displayType: DataDisplayType;
  insight?: string;
  sqlQuery?: string;
  column_order?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

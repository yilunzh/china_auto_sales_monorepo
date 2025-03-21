import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Helper function for merging Tailwind CSS classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a unique ID for messages
export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Format data for display in charts
export function formatChartData(data: any[], xKey: string, yKey: string) {
  if (!data || !data.length) return [];
  
  return data.map(item => ({
    name: item[xKey],
    value: typeof item[yKey] === 'number' ? item[yKey] : parseInt(item[yKey]),
  }));
}

// Helper to determine if result is time series data
export function isTimeSeriesData(data: any[]) {
  if (!data || !data.length) return false;
  
  const firstItem = data[0];
  return (
    (firstItem.hasOwnProperty('year') || firstItem.hasOwnProperty('month')) &&
    (firstItem.hasOwnProperty('total_units_sold') || 
     firstItem.hasOwnProperty('model_units_sold') ||
     firstItem.hasOwnProperty('sales') ||
     firstItem.hasOwnProperty('units'))
  );
}

// Helper to determine if result is categorical data
export function isCategoricalData(data: any[]) {
  if (!data || !data.length) return false;
  
  const firstItem = data[0];
  return (
    (firstItem.hasOwnProperty('manufacturer_name') || 
     firstItem.hasOwnProperty('model_name') ||
     firstItem.hasOwnProperty('manufacturer') ||
     firstItem.hasOwnProperty('model')) &&
    (firstItem.hasOwnProperty('total_units_sold') || 
     firstItem.hasOwnProperty('model_units_sold') ||
     firstItem.hasOwnProperty('sales') ||
     firstItem.hasOwnProperty('units'))
  );
}

// Format a date for display
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).format(date);
}

// Format a cell value for display
export function formatCellValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    // Format numbers with commas for thousands
    return value.toLocaleString();
  }
  return String(value);
}

// Format column names for display
export function formatColumnName(columnName: string): string {
  return columnName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
} 
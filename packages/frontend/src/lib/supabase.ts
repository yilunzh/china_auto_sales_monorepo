import { createClient } from '@supabase/supabase-js';

// These will be loaded from environment variables or .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// For server components, we'll use the service role key when needed
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create the client for client components (less privileged)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Create a client with service role for server components (more privileged)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Define interfaces for our grouped data
interface ManufacturerGroup {
  [key: string]: {
    manufacturer_name: string;
    total_units_sold: number;
  };
}

interface YearGroup {
  [key: number]: {
    year: number;
    total_units_sold: number;
  };
}

interface MonthGroup {
  [key: number]: {
    month: number;
    total_units_sold: number;
  };
}

// Function to execute SQL queries using Supabase's query builder
export async function executeSqlQuery(query: string, params: any[] = []) {
  try {
    console.log("Executing SQL query:", query); // Log the full query
    
    // Check if API_URL is defined in environment variables
    const apiUrl = process.env.NEXT_PUBLIC_SQL_API_URL || 'http://localhost:8000';
    
    // Call the FastAPI backend to execute the query
    const response = await fetch(`${apiUrl}/sql/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 10000 // Set a higher limit for production queries
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("SQL API error:", errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    // If there was an error from the API
    if (result.error) {
      console.error("SQL query error:", result.error);
      return { data: null, error: new Error(result.error) };
    }
    
    const data = result.data;
    
    console.log("Query returned rows:", result.rows_returned);
    if (data && data.length > 0) {
      console.log("First result:", data[0]);
    } else {
      console.log("No data returned from query");
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('SQL query execution error:', error);
    return { data: null, error };
  }
}

// Interface for the schema metadata response from the API
export interface SchemaMetadata {
  tables: {
    [tableName: string]: {
      description: string;
      columns: {
        [columnName: string]: string;
      };
    };
  };
  error?: string;
}

// Function to fetch schema metadata from the backend
export async function fetchSchemaMetadata(tableName?: string): Promise<SchemaMetadata | null> {
  try {
    // Check if API_URL is defined in environment variables
    const apiUrl = process.env.NEXT_PUBLIC_SQL_API_URL || 'http://localhost:8000';
    
    // Build the URL with optional table name parameter
    let url = `${apiUrl}/sql/schema`;
    if (tableName) {
      url += `?table_name=${encodeURIComponent(tableName)}`;
    }
    
    // Call the FastAPI backend to get schema metadata
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Schema metadata API error:", errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    // If there was an error from the API
    if (result.error) {
      console.error("Schema metadata error:", result.error);
      return null;
    }
    
    return result as SchemaMetadata;
  } catch (error) {
    console.error('Schema metadata fetch error:', error);
    return null;
  }
} 
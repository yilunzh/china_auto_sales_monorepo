import { NextResponse } from 'next/server';
import { executeSqlQuery } from '@/lib/supabase';

function determineDisplayType(sqlQuery: string, data: any[]): 'table' | 'bar' | 'line' | 'pie' {
  if (!data || data.length === 0) return 'table';

  const query = sqlQuery.toLowerCase();
  const firstRow = data[0];
  const columns = Object.keys(firstRow || {});

  // Time series data (contains year/month and has ordered results) - use line chart
  if (
    (query.includes('year') || query.includes('month')) &&
    (query.includes('order by year') || query.includes('order by month'))
  ) {
    return 'line';
  }

  // Comparison between categories (typically fewer than 10 items) - use bar chart
  if (
    data.length < 10 && 
    columns.some(col => ['manufacturer_name', 'model_name'].includes(col.toLowerCase()))
  ) {
    return 'bar';
  }

  // Market share or percentage distribution - use pie chart
  if (
    query.includes('percentage') || 
    query.includes('market share') ||
    query.includes('proportion')
  ) {
    return 'pie';
  }

  // Default to table for complex data or when uncertain
  return 'table';
}

export async function POST(request: Request) {
  try {
    const { sqlQuery } = await request.json();

    if (!sqlQuery) {
      return NextResponse.json(
        { error: 'SQL query is required' },
        { status: 400 }
      );
    }

    // Execute SQL query
    const { data, error } = await executeSqlQuery(sqlQuery);

    if (error) {
      return NextResponse.json(
        { error: `Error executing SQL: ${error}` },
        { status: 500 }
      );
    }

    // Determine best visualization type
    const displayType = determineDisplayType(sqlQuery, data || []);

    return NextResponse.json({
      data,
      displayType
    });
  } catch (error) {
    console.error('SQL execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute query' },
      { status: 500 }
    );
  }
} 
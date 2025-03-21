import os
import traceback
from typing import Dict, List, Any, Optional, Tuple
from dotenv import load_dotenv
import json
import time

# Import the existing Supabase client
from .supabase_client import get_supabase_client

# Load environment variables
load_dotenv()
load_dotenv('.env.local')  # Load .env.local which should override .env

async def execute_sql_query(
    query: str, 
    limit: int = 1000
) -> Tuple[List[Dict[str, Any]], List[str], Optional[str]]:
    """
    Execute a SQL query against the Supabase database using the built-in exec_sql function.
    
    Args:
        query: SQL query to execute (must be a SELECT query or WITH clause)
        limit: Maximum number of rows to return
    
    Returns:
        Tuple containing:
        - List of records (as dictionaries)
        - List of column names in the order they appear in the query
        - Error message (if any)
    """
    start_time = time.time()
    print(f"[TIMING] Starting SQL execution at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Validate that this is a safe read-only query for security
    cleaned_query = query.strip().lower()
    
    # Allow both SELECT queries and WITH clauses (CTEs)
    is_select_query = cleaned_query.startswith("select")
    is_with_clause = cleaned_query.startswith("with")
    
    if not (is_select_query or is_with_clause):
        return [], [], f"Only SELECT queries or WITH clauses are allowed for security reasons. Attempted query: {query[:100]}{'...' if len(query) > 100 else ''}"
    
    # For WITH clauses, do some basic validation to ensure they end with a SELECT
    if is_with_clause:
        # Simple check to ensure the WITH clause is used for a SELECT operation
        # This is not foolproof, but provides basic validation
        sections = cleaned_query.split(')')
        found_select = False
        for section in sections:
            if 'select' in section and not ('insert' in section or 'update' in section or 'delete' in section):
                found_select = True
                break
        
        if not found_select:
            return [], [], f"WITH clauses must be used for SELECT operations only. Attempted query: {query[:100]}{'...' if len(query) > 100 else ''}"
    
    try:
        # Format the query: remove trailing semicolons and whitespace
        formatted_query = query.strip()
        if formatted_query.endswith(';'):
            formatted_query = formatted_query[:-1]
        
        # Add LIMIT if it doesn't exist and it's not a WITH clause (CTEs handle limits differently)
        if "limit" not in cleaned_query and not is_with_clause:
            formatted_query = formatted_query + f" LIMIT {limit}"
        
        print(f"Executing query: {formatted_query}")
        
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Before actual database call
        db_call_start = time.time()
        print(f"[TIMING] DB call preparation took {(db_call_start - start_time) * 1000:.2f}ms")
        
        # Call the exec_sql RPC function
        try:
            response = supabase.rpc('exec_sql', {'sql': formatted_query}).execute()
            
            # In the newer Supabase client, we need to handle the response differently
            # Get the data from the response
            data = response.data
            
            # If data is not a list or is empty, handle appropriately
            if not data:
                return [], [], None
            
            if isinstance(data, dict) and 'error' in data:
                return [], [], f"Query error: {data['error']}. Query: {formatted_query[:100]}{'...' if len(formatted_query) > 100 else ''}"
            
            # If data is not a list (e.g., it's a dictionary with information)
            if data and not isinstance(data, list):
                # Try to convert to list if it's not already
                data = [data]
            
            # Try to extract column order from the query for SELECT statements
            columns = []
            try:
                # For WITH clauses, extract the main SELECT statement
                if is_with_clause:
                    # Find the last SELECT statement in the query
                    query_parts = formatted_query.lower().split('select')
                    if len(query_parts) > 1:
                        # Use the last SELECT statement for column extraction
                        last_select_part = 'select' + query_parts[-1]
                        
                        # Extract between SELECT and FROM (or GROUP BY if no FROM)
                        if 'from' in last_select_part:
                            select_part = last_select_part.split('from')[0].strip()
                        elif 'group by' in last_select_part:
                            select_part = last_select_part.split('group by')[0].strip()
                        else:
                            select_part = last_select_part.strip()
                        
                        select_part = select_part.replace('select', '', 1).strip()
                    else:
                        select_part = ""
                else:
                    # Regular SELECT query
                    select_part = formatted_query.lower().split('from')[0].strip()
                    if 'select' in select_part:
                        select_part = select_part.replace('select', '', 1).strip()
                
                # Handle column aliases and functions in a basic way
                if select_part:
                    column_parts = []
                    current_part = ""
                    paren_count = 0
                    quote_type = None  # Track quote type (' or ")
                    
                    # Parse the SELECT part to handle parentheses and quotes correctly
                    for char in select_part:
                        # Handle comma separators (only outside parentheses and quotes)
                        if char == ',' and paren_count == 0 and quote_type is None:
                            column_parts.append(current_part.strip())
                            current_part = ""
                        else:
                            # Track parentheses depth
                            if char == '(' and quote_type is None:
                                paren_count += 1
                            elif char == ')' and quote_type is None:
                                paren_count -= 1
                            # Track quote state
                            elif char == "'" and quote_type is None:
                                quote_type = "'"
                            elif char == '"' and quote_type is None:
                                quote_type = '"'
                            elif char == quote_type:
                                quote_type = None
                                
                            current_part += char
                    
                    if current_part:
                        column_parts.append(current_part.strip())
                    
                    # Extract column names or aliases
                    for part in column_parts:
                        part_lower = part.lower()
                        # If there's an AS keyword, get the alias
                        if ' as ' in part_lower:
                            alias_part = part_lower.split(' as ')[-1].strip()
                            # Handle quoted identifiers
                            if (alias_part.startswith('"') and alias_part.endswith('"')) or \
                               (alias_part.startswith("'") and alias_part.endswith("'")):
                                # Extract the actual name without quotes
                                alias = alias_part[1:-1]
                            else:
                                alias = alias_part
                            columns.append(alias)
                        # For simple columns without AS
                        else:
                            # Just take the last part after any dots (table.column)
                            col_name = part.split('.')[-1].strip()
                            # Handle quoted identifiers
                            if (col_name.startswith('"') and col_name.endswith('"')) or \
                               (col_name.startswith("'") and col_name.endswith("'")):
                                col_name = col_name[1:-1]
                            columns.append(col_name)
                    
                    print(f"Extracted columns: {columns}")
            except Exception as e:
                # If column extraction fails, fall back to keys from data
                print(f"Column extraction failed: {str(e)}")
                
            # If column extraction failed or is incomplete, use data keys as fallback
            if not columns:
                columns = list(data[0].keys()) if data and len(data) > 0 else []
            
            # IMPORTANT: If we extracted column order but data doesn't match these columns,
            # we need to ensure the data maintains the correct order in JavaScript objects
            if data and len(data) > 0 and columns:
                # Create ordered data with column order preserved
                ordered_data = []
                for row in data:
                    # Create a new ordered dictionary for each row
                    ordered_row = {}
                    # First add columns we know about in the correct order
                    for col in columns:
                        if col in row:
                            ordered_row[col] = row[col]
                    # Then add any other columns we didn't recognize
                    for key, value in row.items():
                        if key not in ordered_row:
                            ordered_row[key] = value
                    ordered_data.append(ordered_row)
                data = ordered_data
                
            print(f"Query returned {len(data)} rows")
            
            # After database call
            db_call_end = time.time()
            print(f"[TIMING] DB execution took {(db_call_end - db_call_start) * 1000:.2f}ms")
            
            # Before data processing
            processing_start = time.time()
            
            # End timing
            end_time = time.time()
            print(f"[TIMING] Data processing took {(end_time - processing_start) * 1000:.2f}ms")
            print(f"[TIMING] Total SQL query execution took {(end_time - start_time) * 1000:.2f}ms")
            
            return data, columns, None
            
        except Exception as e:
            # Check if this is a dictionary with error information
            if hasattr(e, 'message'):
                return [], [], f"Database error: {e.message}. Query: {formatted_query[:100]}{'...' if len(formatted_query) > 100 else ''}"
            return [], [], f"Error executing RPC: {str(e)}. Query: {formatted_query[:100]}{'...' if len(formatted_query) > 100 else ''}"
    
    except Exception as e:
        error_time = time.time()
        print(f"[TIMING] SQL error after {(error_time - start_time) * 1000:.2f}ms: {str(e)}")
        error_message = f"Error executing query: {str(e)}. Query: {query[:100]}{'...' if len(query) > 100 else ''}" + f"\n{traceback.format_exc()}"
        return [], [], error_message
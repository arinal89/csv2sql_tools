/**
 * API Service for communicating with the Python backend
 */

// Base URL for API requests
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Process a CSV file and get basic information
 * @param file CSV file to process
 */
export const processCSV = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    // Set a longer timeout for large files (120 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(`${API_BASE_URL}/process-csv`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Try to parse error response as JSON
      try {
        const error = await response.json();
        throw new Error(error.error || `Failed to process CSV (${response.status})`);
      } catch (jsonError) {
        // If JSON parsing fails, use text response
        const errorText = await response.text();
        throw new Error(errorText || `Failed to process CSV (${response.status})`);
      }
    }
    
    return response.json();
  } catch (error: any) {
    // Handle specific errors with more user-friendly messages
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The file may be too large for server processing.');
    } else if (error.message && error.message.includes('NetworkError')) {
      throw new Error('Network error. The file may be too large for upload.');
    }
    throw error;
  }
};

/**
 * Convert CSV data to SQL
 * @param csvData CSV data to convert
 * @param tableName Name of the SQL table
 * @param batchSize Number of rows per INSERT statement (default: 1)
 */
export const csvToSQL = async (csvData: any[], tableName: string, batchSize: number = 1) => {
  const response = await fetch(`${API_BASE_URL}/csv-to-sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      csvData,
      tableName,
      batchSize,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to convert CSV to SQL');
  }
  
  return response.json();
};

/**
 * Normalize CSV data
 * @param file CSV file to normalize
 */
export const normalizeCSV = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    // Set a longer timeout for large files (120 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(`${API_BASE_URL}/normalize-csv`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Try to parse error response as JSON
      try {
        const error = await response.json();
        throw new Error(error.error || `Failed to normalize CSV (${response.status})`);
      } catch (jsonError) {
        // If JSON parsing fails, use text response
        const errorText = await response.text();
        throw new Error(errorText || `Failed to normalize CSV (${response.status})`);
      }
    }
    
    return response.json();
  } catch (error: any) {
    // Handle specific errors with more user-friendly messages
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The file may be too large for server processing.');
    } else if (error.message && error.message.includes('NetworkError')) {
      throw new Error('Network error. The file may be too large for upload.');
    }
    throw error;
  }
};

/**
 * Handle null values in CSV data
 * @param csvData CSV data to process
 * @param strategy Strategy for handling nulls (e.g., 'drop', 'mean', 'median', etc.)
 * @param columns Columns to apply the strategy to
 * @param fillValue Value to fill nulls with (if strategy is 'value')
 */
export const handleNulls = async (
  csvData: any[], 
  strategy: string, 
  columns?: string[], 
  fillValue?: any
) => {
  const response = await fetch(`${API_BASE_URL}/handle-nulls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      csvData,
      strategy,
      columns,
      fillValue,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to handle nulls');
  }
  
  return response.json();
};

/**
 * Determine data types in CSV
 * @param file CSV file to analyze
 */
export const determineDataTypes = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    // Set a longer timeout for large files (120 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    const response = await fetch(`${API_BASE_URL}/determine-datatypes`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Try to parse error response as JSON
      try {
        const error = await response.json();
        throw new Error(error.error || `Failed to determine data types (${response.status})`);
      } catch (jsonError) {
        // If JSON parsing fails, use text response
        const errorText = await response.text();
        throw new Error(errorText || `Failed to determine data types (${response.status})`);
      }
    }
    
    return response.json();
  } catch (error: any) {
    // Handle specific errors with more user-friendly messages
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The file may be too large for server processing.');
    } else if (error.message && error.message.includes('Expected') && error.message.includes('fields')) {
      throw new Error(`CSV format error: Your file has inconsistent columns. ${error.message}`);
    } else if (error.message && error.message.includes('NetworkError')) {
      throw new Error('Network error. The file may be too large for upload.');
    }
    throw error;
  }
};

/**
 * Split SQL file into smaller chunks
 * @param sqlContent SQL content to split
 * @param maxChunkSize Maximum size of each chunk (in lines)
 */
export const splitSQL = async (sqlContent: string, maxChunkSize: number = 1000) => {
  const response = await fetch(`${API_BASE_URL}/sql-splitter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sqlContent,
      maxChunkSize,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to split SQL');
  }
  
  return response.json();
};

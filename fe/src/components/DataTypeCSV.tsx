import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { 
  Upload, Download, Type, AlertCircle, CheckCircle, Loader, Database, 
  Copy, Settings
} from 'lucide-solid';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';

interface ColumnInfo {
  name: string;
  detectedType: string;
  selectedType: string;
  sampleValues: string[];
  nullCount: number;
  totalCount: number;
}

// Map CSV types to SQL types
const mapToSQLType = (csvType: string): string => {
  switch (csvType.toUpperCase()) {
    case 'STRING': return 'VARCHAR(255)';
    case 'INTEGER': return 'INTEGER';
    case 'FLOAT': return 'DECIMAL(10,2)';
    case 'BOOLEAN': return 'BOOLEAN';
    case 'DATE': return 'DATE';
    case 'DATETIME': return 'DATETIME';
    case 'EMAIL': return 'VARCHAR(255)';
    case 'URL': return 'VARCHAR(2048)';
    case 'PHONE': return 'VARCHAR(20)';
    case 'CURRENCY': return 'DECIMAL(15,2)';
    default: return 'VARCHAR(255)';
  }
};

const DataTypeCSV: Component = () => {
  const { theme } = useTheme();
  const [csvData, setCsvData] = createSignal<any[][] | null>(null);
  const [headers, setHeaders] = createSignal<string[]>([]);
  const [columnInfo, setColumnInfo] = createSignal<ColumnInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [loadingProgress, setLoadingProgress] = createSignal(0);
  const [showLoadingPopup, setShowLoadingPopup] = createSignal(false);
  const [sqlDialect, setSqlDialect] = createSignal<'mysql' | 'postgresql' | 'sqlite'>('mysql');
  const [tableName, setTableName] = createSignal('my_table');
  const [showSqlOutput, setShowSqlOutput] = createSignal(false);
  const [generatedSQL, setGeneratedSQL] = createSignal<{create: string, insert: string}>({create: '', insert: ''});
  const [maxRowsInInsert, setMaxRowsInInsert] = createSignal(500);
  const [includeNulls, setIncludeNulls] = createSignal(true);
  const [showSqlSettings, setShowSqlSettings] = createSignal(false);
  const [insertMode, setInsertMode] = createSignal<'single' | 'batch' | 'multiple'>('batch');
  const [isLargeFile, setIsLargeFile] = createSignal(false);
  const [fileSizeMB, setFileSizeMB] = createSignal(0);
  const [showColumnAnalysis, setShowColumnAnalysis] = createSignal(true);
  const LARGE_FILE_THRESHOLD_MB = 5; // Files larger than 5MB will trigger performance warning

  const dataTypes = [
    'STRING',
    'INTEGER',
    'FLOAT',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'EMAIL',
    'URL',
    'PHONE',
    'CURRENCY'
  ];

  const simulateProgress = () => {
    setShowLoadingPopup(true);
    setLoadingProgress(0);
    
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        // Gradually increase up to 90%, leaving room for the actual API response
        const nextProgress = prev + (90 - prev) * 0.1;
        return nextProgress > 90 ? 90 : nextProgress;
      });
    }, 100);
    
    return interval;
  };

  // Validate CSV file before upload
  const validateCSVFile = (file: File): boolean => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file (.csv extension)');
      return false;
    }
    
    // Check file size and set warning flag for large files
    const fileSizeInMB = file.size / (1024 * 1024);
    setFileSizeMB(Math.round(fileSizeInMB * 100) / 100);
    
    if (fileSizeInMB > LARGE_FILE_THRESHOLD_MB) {
      setIsLargeFile(true);
      // Still allow the file to be processed, but with a warning
    } else {
      setIsLargeFile(false);
    }
    
    return true;
  };

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) {
      setError('No file selected');
      return;
    }

    // Reset previous state
    setLoading(true);
    setError('');
    setSuccess('');
    setCsvData(null);
    setHeaders([]);
    setColumnInfo([]);
    
    // Validate file before proceeding
    if (!validateCSVFile(file)) {
      setLoading(false);
      return;
    }

    // Use cache if available
    const cacheKey = createCacheKey(file);
    if (csvCache.has(cacheKey)) {
      const cached = csvCache.get(cacheKey)!;
      setHeaders(cached.headers);
      setCsvData(cached.data.slice(0, 20));
      setColumnInfo(cached.columnInfo);
      setSuccess(`Loaded from cache: ${file.name}`);
      setLoading(false);
      return;
    }
    
    // Start progress simulation
    const progressInterval = simulateProgress();
    try {
      // Parse the CSV file
      const parsedData = await parseCSVDirectly(file);
      setLoadingProgress(100);
      if (!parsedData || !parsedData.headers || parsedData.headers.length === 0) {
        throw new Error('No data parsed from file');
      }
      const fileHeaders = parsedData.headers;
      const rows = parsedData.data;
      // Analyze each column for data types
      const typeInfo: Record<string, any> = {};
      fileHeaders.forEach(header => {
        const columnValues = rows.map(row => (row as any)[header]).filter(v => v !== null && v !== undefined && v !== '');
        const detected = detectDataType(columnValues);
        const nullCount = rows.length - columnValues.length;
        typeInfo[header] = {
          detected: detected.toLowerCase(),
          nullCount
        };
      });
      // Prepare preview data
      const previewData = rows.slice(0, 20);
      const data = previewData.map((row: any) => fileHeaders.map(header => row[header]));
      setHeaders(fileHeaders);
      setCsvData(data);
      const columns: ColumnInfo[] = fileHeaders.map(header => {
        const info = typeInfo[header];
        if (!info) {
          throw new Error(`Missing type information for column: ${header}`);
        }
        return {
          name: header,
          detectedType: (info.detected || 'STRING').toUpperCase(),
          selectedType: (info.detected || 'STRING').toUpperCase(),
          sampleValues: previewData.slice(0, 5).map((row: any) => row[header]?.toString() || ''),
          nullCount: info.nullCount || 0,
          totalCount: rows.length
        };
      });
      setColumnInfo(columns);
      // Cache the result for future use
      csvCache.set(cacheKey, {
        headers: fileHeaders,
        data: rows.map((row: any) => fileHeaders.map(header => row[header])),
        columnInfo: columns
      });
      let successMsg = `Data types analyzed successfully! ${fileHeaders.length} columns detected.`;
      setSuccess(successMsg);
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      if (errorMsg.includes('Expected') && errorMsg.includes('fields')) {
        setError(`CSV parsing error: Your file has inconsistent column counts. Check line ${
          errorMsg.match(/line (\d+)/)?.[1] || 'unknown'
        } in your CSV file.`);
      } else {
        setError(`Error analyzing data types: ${errorMsg}`);
      }
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      setTimeout(() => {
        setShowLoadingPopup(false);
        setLoadingProgress(0);
      }, 500);
    }
  };
  
  // Parse CSV directly without using the backend
  const parseCSVDirectly = async (file: File) => {
    return new Promise<{headers: string[], data: any[]}>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim(),
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
            return;
          }
          
          if (!results.data || results.data.length === 0) {
            reject(new Error('No data found in CSV file'));
            return;
          }
          
          const headers = results.meta.fields || [];
          
          resolve({
            headers,
            data: results.data as any[]
          });
        },
        error: (error) => {
          reject(new Error(`Error parsing CSV: ${error.message}`));
        }
      });
    });
  };

  const updateColumnType = (columnIndex: number, newType: string) => {
    const updated = columnInfo().map((col, index) => 
      index === columnIndex ? { ...col, selectedType: newType } : col
    );
    setColumnInfo(updated);
  };

  const validateDataTypes = () => {
    const data = csvData();
    if (!data) return [];

    const warnings: string[] = [];
    const columns = columnInfo();

    columns.forEach((col, colIndex) => {
      const columnValues = data.map(row => row[colIndex]).filter(v => v !== null && v !== undefined && v !== '');
      
      let invalidCount = 0;
      columnValues.forEach(value => {
        if (!isValidForType(value, col.selectedType)) {
          invalidCount++;
        }
      });

      if (invalidCount > 0) {
        warnings.push(`Column "${col.name}": ${invalidCount} values don't match selected type "${col.selectedType}"`);
      }
    });

    return warnings;
  };

  const isValidForType = (value: any, type: string): boolean => {
    const str = String(value);
    
    switch (type) {
      case 'INTEGER':
        return /^-?\d+$/.test(str);
      case 'FLOAT':
        return !isNaN(Number(str)) && !isNaN(parseFloat(str));
      case 'BOOLEAN':
        return ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(str.toLowerCase());
      case 'DATE':
        return !isNaN(Date.parse(str));
      case 'EMAIL':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
      case 'URL':
        try {
          new URL(str);
          return true;
        } catch {
          return false;
        }
      case 'PHONE':
        return /^[\+]?[\s\-\(\)]*([0-9][\s\-\(\)]*){10,}$/.test(str);
      case 'CURRENCY':
        return /^[\$\€\£\¥]?[\d,]+\.?\d*$/.test(str);
      default:
        return true; // STRING accepts everything
    }
  };

  const downloadTypedCSV = () => {
    const data = csvData();
    const fileHeaders = headers();
    const columns = columnInfo();
    if (!data || !fileHeaders || !columns) return;

    // Convert data based on selected types
    const convertedData = data.map(row => {
      return row.map((cell, index) => {
        const column = columns[index];
        if (!column || cell === null || cell === undefined || cell === '') {
          return cell;
        }

        const str = String(cell);
        switch (column.selectedType) {
          case 'INTEGER':
            return parseInt(str) || cell;
          case 'FLOAT':
            return parseFloat(str) || cell;
          case 'BOOLEAN':
            return ['true', '1', 'yes', 'y'].includes(str.toLowerCase()) ? 'true' : 'false';
          case 'DATE':
            const date = new Date(str);
            return isNaN(date.getTime()) ? cell : date.toISOString().split('T')[0];
          default:
            return cell;
        }
      });
    });

    const csvContent = [
      fileHeaders.join(','),
      ...convertedData.map(row => 
        row.map(cell => {
          const str = String(cell || '');
          return str.includes(',') || str.includes('"') || str.includes('\n') 
            ? `"${str.replace(/"/g, '""')}"` 
            : str;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'typed_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('Typed CSV downloaded!');
  };

  // Basic data type detection for parsed CSV data
  const detectDataType = (values: any[]): string => {
    // Filter out null/undefined/empty values
    const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
    if (nonEmptyValues.length === 0) return 'STRING';
    
    // Take a sample for faster processing
    const sample = nonEmptyValues.slice(0, 100);
    
    // Check if all values are numbers
    const allNumbers = sample.every(v => !isNaN(Number(v)) && !isNaN(parseFloat(String(v))));
    if (allNumbers) {
      // Check if all are integers
      const allIntegers = sample.every(v => Number.isInteger(Number(v)));
      return allIntegers ? 'INTEGER' : 'FLOAT';
    }
    
    // Check if all values are dates
    const allDates = sample.every(v => !isNaN(Date.parse(String(v))));
    if (allDates) return 'DATE';
    
    // Check if all values are boolean
    const booleanValues = ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'];
    const allBooleans = sample.every(v => 
      booleanValues.includes(String(v).toLowerCase())
    );
    if (allBooleans) return 'BOOLEAN';
    
    // Check for emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allEmails = sample.every(v => emailRegex.test(String(v)));
    if (allEmails) return 'EMAIL';
    
    // Check for URLs
    const allUrls = sample.every(v => {
      try {
        new URL(String(v));
        return true;
      } catch {
        return false;
      }
    });
    if (allUrls) return 'URL';
    
    // Check for phone numbers
    const phoneRegex = /^[\+]?[\s\-\(\)]*([0-9][\s\-\(\)]*){10,}$/;
    const allPhones = sample.every(v => phoneRegex.test(String(v)));
    if (allPhones) return 'PHONE';
    
    // Check for currency
    const currencyRegex = /^[\$\€\£\¥]?[\d,]+\.?\d*$/;
    const allCurrency = sample.every(v => currencyRegex.test(String(v)));
    if (allCurrency) return 'CURRENCY';
    
    // Default to string
    return 'STRING';
  };

  // Convert value to SQL-safe string
  const escapeSQL = (value: any, type: string, withNulls: boolean = true): string => {
    if (value === null || value === undefined || value === '') {
      return withNulls ? 'NULL' : "''";
    }
    
    switch (type.toUpperCase()) {
      case 'INTEGER':
      case 'FLOAT':
        return value.toString();
      case 'BOOLEAN':
        return value.toString().toLowerCase() === 'true' ? '1' : '0';
      default:
        // Escape single quotes by doubling them
        return `'${value.toString().replace(/'/g, "''")}'`;
    }
  };

  // Escape column names according to SQL dialect
  const escapeColumnName = (name: string, dialect: string): string => {
    // Remove special characters for safety
    const cleanName = name.replace(/[^\w]/g, '_');
    
    switch (dialect) {
      case 'mysql':
        return `\`${cleanName}\``;
      case 'postgresql':
        return `"${cleanName}"`;
      case 'sqlite':
      default:
        return `"${cleanName}"`;
    }
  };

  // Generate CREATE TABLE SQL statement
  const generateCreateTableSQL = (columns: ColumnInfo[], dialect: string, tblName: string): string => {
    let sql = `CREATE TABLE ${tblName} (\n`;
    
    // Add column definitions
    sql += columns.map(col => {
      const sqlType = mapToSQLType(col.selectedType);
      const nullable = col.nullCount > 0 ? 'NULL' : 'NOT NULL';
      return `  ${escapeColumnName(col.name, dialect)} ${sqlType} ${nullable}`;
    }).join(',\n');
    
    // Close the statement
    sql += '\n);';
    
    return sql;
  };

  // Generate INSERT statements
  const generateInsertSQL = (
    data: any[][], 
    columns: ColumnInfo[], 
    dialect: string, 
    tblName: string,
    maxRows: number = 500,
    withNulls: boolean = true
  ): string => {
    if (!data || data.length === 0) return '';
    
    const columnNames = columns.map(col => escapeColumnName(col.name, dialect)).join(', ');
    let sql = '';
    
    // Limit the number of rows if specified
    const rowsToProcess = maxRows > 0 && maxRows < data.length ? data.slice(0, maxRows) : data;
    
    switch (insertMode()) {
      case 'single':
        // Generate individual INSERT statements for each row
        rowsToProcess.forEach(row => {
          const values = columns.map((col, colIndex) => {
            return escapeSQL(row[colIndex], col.selectedType, withNulls);
          }).join(', ');
          sql += `INSERT INTO ${tblName} (${columnNames})\nVALUES (${values});\n`;
        });
        break;
      
      case 'multiple':
        // Generate a single INSERT with multiple VALUES
        sql += `INSERT INTO ${tblName} (${columnNames})\nVALUES\n`;
        sql += rowsToProcess.map(row => {
          const values = columns.map((col, colIndex) => {
            return escapeSQL(row[colIndex], col.selectedType, withNulls);
          }).join(', ');
          return `  (${values})`;
        }).join(',\n');
        sql += ';\n';
        break;
      
      case 'batch':
      default:
        // Use batch inserts for better performance (50 rows per batch)
        const batchSize = 50;
        for (let i = 0; i < rowsToProcess.length; i += batchSize) {
          const batch = rowsToProcess.slice(i, i + batchSize);
          
          sql += `INSERT INTO ${tblName} (${columnNames})\nVALUES\n`;
          
          // Generate values for each row
          sql += batch.map(row => {
            const values = columns.map((col, colIndex) => {
              return escapeSQL(row[colIndex], col.selectedType, withNulls);
            }).join(', ');
            return `  (${values})`;
          }).join(',\n');
          
          sql += ';\n\n';
        }
        break;
    }
    
    if (maxRows > 0 && maxRows < data.length) {
      sql += `-- Note: Only showing ${maxRows} out of ${data.length} rows\n`;
      sql += `-- Modify the 'Max Rows' setting to change this limit\n`;
    }
    
    return sql;
  };

  // Generate full SQL (CREATE + INSERT)
  const generateSQL = () => {
    if (!csvData() || columnInfo().length === 0) {
      setError('No data available to generate SQL');
      return;
    }

    try {
      setLoading(true);
      const create = generateCreateTableSQL(columnInfo(), sqlDialect(), tableName());
      const insert = generateInsertSQL(
        csvData()!, 
        columnInfo(), 
        sqlDialect(), 
        tableName(),
        maxRowsInInsert(),
        includeNulls()
      );
      
      setGeneratedSQL({ create, insert });
      setShowSqlOutput(true);
      setSuccess('SQL generated successfully!');
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to generate SQL: ${err.message}`);
      setLoading(false);
    }
  };
  
  // Copy SQL to clipboard
  const copyToClipboard = (text: string, message: string = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(text).then(
      () => {
        setSuccess(message);
        setTimeout(() => setSuccess(''), 2000);
      },
      () => {
        setError('Failed to copy to clipboard');
      }
    );
  };
  
  // Copy entire SQL (CREATE + INSERT) to clipboard
  const copyAllSQL = () => {
    const sql = `-- Table Creation\n${generatedSQL().create}\n\n-- Data Insertion\n${generatedSQL().insert}`;
    copyToClipboard(sql, 'All SQL copied to clipboard!');
  };
  
  // Download SQL file
  const downloadSQL = () => {
    const sql = `-- Table Creation\n${generatedSQL().create}\n\n-- Data Insertion\n${generatedSQL().insert}`;
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName()}_${sqlDialect()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('SQL file downloaded!');
  };

  // Create a cache for parsed CSV files
  const csvCache = new Map<string, {
    headers: string[],
    data: any[][],
    columnInfo: ColumnInfo[]
  }>();
  
  const createCacheKey = (file: File): string => {
    return `${file.name}_${file.size}_${file.lastModified}`;
  };

  return (
    <div class="w-full space-y-6">
      {/* Error and Success Messages */}
      {error() && (
        <div class={`rounded-lg shadow-sm border p-4 ${
          theme() === 'dark' 
            ? 'bg-red-900/20 border-red-800' 
            : 'bg-red-50 border-red-400'
        }`}>
          <div class="flex">
            <div class="flex-shrink-0">
              <AlertCircle class={`h-5 w-5 ${
                theme() === 'dark' ? 'text-red-500' : 'text-red-400'
              }`} />
            </div>
            <div class="ml-3">
              <h3 class={`text-sm font-medium ${
                theme() === 'dark' ? 'text-red-400' : 'text-red-800'
              }`}>
                Error
              </h3>
              <div class={`mt-2 text-sm ${
                theme() === 'dark' ? 'text-red-300' : 'text-red-700'
              }`}>
                <p>{error()}</p>
                
                {error().includes('parsing error') || error().includes('inconsistent') ? (
                  <div class={`mt-3 p-3 border rounded ${
                    theme() === 'dark' 
                      ? 'bg-red-900/30 border-red-700' 
                      : 'bg-red-100 border-red-300'
                  }`}>
                    <p class="font-medium">Troubleshooting Tips:</p>
                    <ul class="list-disc list-inside mt-1 space-y-1 text-xs">
                      <li>Check if your CSV has consistent number of columns in each row</li>
                      <li>Look for missing or extra delimiters (commas)</li>
                      <li>If fields contain commas, ensure they're properly quoted</li>
                      <li>Try using the manual parsing options below</li>
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {success() && (
        <div class={`rounded-lg shadow-sm border p-4 ${
          theme() === 'dark' 
            ? 'bg-green-900/20 border-green-800' 
            : 'bg-green-50 border-green-400'
        }`}>
          <div class="flex">
            <div class="flex-shrink-0">
              <CheckCircle class={`h-5 w-5 ${
                theme() === 'dark' ? 'text-green-500' : 'text-green-400'
              }`} />
            </div>
            <div class="ml-3">
              <h3 class={`text-sm font-medium ${
                theme() === 'dark' ? 'text-green-400' : 'text-green-800'
              }`}>
                Success
              </h3>
              <div class={`mt-2 text-sm ${
                theme() === 'dark' ? 'text-green-300' : 'text-green-700'
              }`}>
                <p>{success()}</p>
                
                {columnInfo().length > 0 && (
                  <div class={`mt-3 p-3 border rounded ${
                    theme() === 'dark' 
                      ? 'bg-green-900/30 border-green-700' 
                      : 'bg-green-100 border-green-300'
                  }`}>
                    <p class="font-medium text-xs">Data Type Guide:</p>
                    <ul class="list-disc list-inside mt-1 space-y-1 text-xs">
                      <li>Use the <strong>Selected Type</strong> dropdown to change the data type for each column</li>
                      <li>View sample values to verify the correct data type</li>
                      <li>Click "Download Typed CSV" to export with your selected types</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Popup */}
      <Show when={showLoadingPopup()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class={`rounded-lg shadow-lg p-6 max-w-md w-full ${
            theme() === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div class="flex items-center justify-center mb-4">
              <Loader class={`w-8 h-8 animate-spin ${
                theme() === 'dark' ? 'text-purple-400' : 'text-purple-600'
              }`} />
            </div>
            <h3 class={`text-lg font-semibold text-center mb-4 ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Analyzing Data Types...
            </h3>
            <div class="w-full bg-gray-200 rounded-full h-2.5 mb-2 dark:bg-gray-700">
              <div class="bg-purple-600 h-2.5 rounded-full" style={{ width: `${loadingProgress()}%` }}></div>
            </div>
            <p class={`text-center text-sm ${
              theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {loadingProgress().toFixed(0)}% Complete
            </p>
          </div>
        </div>
      </Show>

      {/* Header */}
      <div class={`rounded-lg shadow-sm border p-6 ${
        theme() === 'dark' 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div class="flex items-center space-x-3 mb-4">
          <div class={`p-2 rounded-lg ${
            theme() === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100'
          }`}>
            <Type class={`w-6 h-6 ${
              theme() === 'dark' ? 'text-purple-400' : 'text-purple-600'
            }`} />
          </div>
          <div>
            <h1 class={`text-2xl font-bold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Data Type Analysis
            </h1>
            <p class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Analyze and configure data types for your CSV columns
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div class={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          theme() === 'dark' 
            ? 'border-gray-600 hover:border-purple-500' 
            : 'border-gray-300 hover:border-purple-400'
        }`}>
          <Upload class={`w-12 h-12 mx-auto mb-4 ${
            theme() === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`} />
          <div class="space-y-2">
            <label class="block">
              <span class="sr-only">Choose CSV file</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={loading()}
                class={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold transition-colors disabled:opacity-50 ${
                  theme() === 'dark'
                    ? 'text-gray-300 file:bg-purple-900/50 file:text-purple-300 hover:file:bg-purple-900/70'
                    : 'text-gray-500 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100'
                }`}
              />
            </label>
            <p class={`text-sm ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {loading() ? 'Analyzing file...' : 'Upload a CSV file to analyze column data types'}
            </p>
            <Show when={isLargeFile()}>
              <div class={`mt-3 p-3 border rounded ${
                theme() === 'dark' 
                  ? 'bg-yellow-900/30 border-yellow-700' 
                  : 'bg-yellow-100 border-yellow-300'
              }`}>
                <p class="text-sm">
                  Warning: This file is large ({fileSizeMB()} MB). Processing may take some time.
                </p>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Column Analysis */}
      <Show when={columnInfo().length > 0}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <h2 class={`text-lg font-semibold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Column Analysis
            </h2>
            <div class="flex items-center space-x-2">
              <button
                onClick={() => setShowColumnAnalysis(!showColumnAnalysis())}
                class={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${
                  theme() === 'dark'
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-label={showColumnAnalysis() ? 'Minimize' : 'Expand'}
              >
                {showColumnAnalysis() ? (
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                  </svg>
                ) : (
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                )}
                <span>{showColumnAnalysis() ? 'Minimize' : 'Expand'}</span>
              </button>
              <div class="flex space-x-2">
                <button
                  onClick={generateSQL}
                  class={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                    theme() === 'dark'
                      ? 'bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                >
                  <Database class="w-4 h-4 mr-2" />
                  Generate SQL
                </button>
                <button
                  onClick={downloadTypedCSV}
                  class={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                    theme() === 'dark'
                      ? 'bg-purple-900/50 text-purple-300 hover:bg-purple-800'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  <Download class="w-4 h-4 mr-2" />
                  Download CSV
                </button>
              </div>
            </div>
          </div>

          <Show when={showColumnAnalysis()}>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class={theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <th class={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme() === 'dark' ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Column Name
                  </th>
                  <th class={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme() === 'dark' ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Detected Type
                  </th>
                  <th class={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme() === 'dark' ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Selected Type
                  </th>
                  <th class={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme() === 'dark' ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Sample Values
                  </th>
                  <th class={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme() === 'dark' ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    Null Count
                  </th>
                </tr>
              </thead>
              <tbody class={`divide-y ${
                theme() === 'dark' 
                  ? 'bg-gray-800 divide-gray-700' 
                  : 'bg-white divide-gray-200'
              }`}>
                <For each={columnInfo()}>
                  {(column, index) => (
                    <tr>
                      <td class={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        theme() === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {column.name}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          theme() === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {column.detectedType}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <div class="relative">
                          <select
                            value={column.selectedType}
                            onChange={(e) => updateColumnType(index(), e.target.value)}
                            class={`appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${
                              column.selectedType !== column.detectedType
                                ? `font-medium ${theme() === 'dark' ? 'text-purple-300 border-purple-500' : 'text-purple-700 border-purple-400'}`
                                : ''
                            } ${
                              theme() === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          >
                            <For each={dataTypes}>
                              {(type) => (
                                <option 
                                  value={type} 
                                  class={type === column.detectedType 
                                    ? 'font-bold' 
                                    : ''
                                  }
                                >
                                  {type} {type === column.detectedType ? '(detected)' : ''}
                                </option>
                              )}
                            </For>
                          </select>
                          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                          </div>
                        </div>
                        {column.selectedType !== column.detectedType ? (
                          <div class={`mt-1 text-xs px-2 py-1 rounded ${
                            theme() === 'dark' 
                              ? 'bg-purple-900/30 text-purple-300 border border-purple-800/50' 
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            <span>Changed from </span>
                            <span class="font-medium">{column.detectedType}</span>
                          </div>
                        ) : (
                          <div class={`mt-1 text-xs px-2 py-1 rounded ${
                            theme() === 'dark'
                              ? 'bg-green-900/30 text-green-300 border border-green-800/50'
                              : 'bg-green-50 text-green-700 border border-green-200'
                          }`}>
                            Using detected type
                          </div>
                        )}
                      </td>
                      <td class="px-6 py-4 text-sm">
                        <div class="max-w-xs">
                          <div class={`border rounded p-2 ${
                            theme() === 'dark' ? 'border-gray-600 bg-gray-700/50' : 'border-gray-200 bg-gray-50'
                          }`}>
                            <div class="flex justify-between items-center mb-2">
                              <p class={`text-xs font-medium ${
                                theme() === 'dark' ? 'text-gray-300' : 'text-gray-600'
                              }`}>Sample Values:</p>
                              
                              <button 
                                class={`text-xs px-1.5 py-0.5 rounded ${
                                  theme() === 'dark' 
                                    ? 'bg-blue-900/40 text-blue-300 hover:bg-blue-800/50' 
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                                onClick={() => {
                                  const formattedSamples = column.sampleValues
                                    .map((v, i) => `${i+1}. ${v || '(empty)'}`)
                                    .join('\n');
                                  alert(`Sample values for "${column.name}":\n\n${formattedSamples}`);
                                }}
                              >
                                View all
                              </button>
                            </div>
                            
                            {column.sampleValues.slice(0, 3).map((value, idx) => (
                              <div 
                                class={`mb-1 px-2 py-1.5 rounded text-xs font-mono ${
                                  theme() === 'dark' 
                                    ? 'bg-gray-800 text-gray-300 border border-gray-700' 
                                    : 'bg-white text-gray-800 border border-gray-200'
                                }`} 
                                title={value}
                              >
                                <div class="flex items-center space-x-1">
                                  <span class={`inline-block w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
                                    theme() === 'dark'
                                      ? 'bg-gray-700 text-gray-300'
                                      : 'bg-gray-200 text-gray-700'
                                  }`}>{idx+1}</span>
                                  <span class="truncate flex-1">{value || '(empty)'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          column.nullCount > 0 
                            ? (theme() === 'dark' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-800')
                            : (theme() === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800')
                        }`}>
                          {column.nullCount} / {column.totalCount}
                        </span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
            </div>
          </Show>
        </div>
      </Show>

      {/* Data Validation Warnings */}
      <Show when={csvData() && columnInfo().length > 0}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <h2 class={`text-lg font-semibold mb-4 ${
            theme() === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Data Validation
          </h2>
          <div class="space-y-2">
            <For each={validateDataTypes()}>
              {(warning) => (
                <div class={`flex items-center p-3 border rounded-lg ${
                  theme() === 'dark' 
                    ? 'bg-yellow-900/20 border-yellow-800' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <AlertCircle class={`w-5 h-5 mr-3 ${
                    theme() === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                  }`} />
                  <span class={`text-sm ${
                    theme() === 'dark' ? 'text-yellow-300' : 'text-yellow-800'
                  }`}>{warning}</span>
                </div>
              )}
            </For>
            <Show when={validateDataTypes().length === 0}>
              <div class={`flex items-center p-3 border rounded-lg ${
                theme() === 'dark' 
                  ? 'bg-green-900/20 border-green-800' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <CheckCircle class={`w-5 h-5 mr-3 ${
                  theme() === 'dark' ? 'text-green-400' : 'text-green-600'
                }`} />
                <span class={`text-sm ${
                  theme() === 'dark' ? 'text-green-300' : 'text-green-800'
                }`}>All data types are valid for the selected columns.</span>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* SQL Generation Section */}
      <Show when={showSqlOutput()}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <h2 class={`text-lg font-semibold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              SQL Generation
            </h2>
            <button
              onClick={generateSQL}
              class={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
                theme() === 'dark'
                  ? 'bg-purple-700 text-white hover:bg-purple-600'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              <Database class="w-4 h-4 mr-2" />
              Generate SQL
            </button>
          </div>
          
          {/* SQL Configuration Panel */}
          <div class="space-y-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class={`text-sm font-medium ${
                theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                SQL Configuration
              </h3>
              <button
                onClick={() => setShowSqlSettings(!showSqlSettings())}
                class={`flex items-center px-2 py-1 text-xs rounded-md ${
                  theme() === 'dark' 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Settings class="w-3 h-3 mr-1" />
                {showSqlSettings() ? 'Hide Settings' : 'Show Settings'}
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class={`block text-sm font-medium ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Table Name
                </label>
                <input
                  type="text"
                  value={tableName()}
                  onInput={(e) => setTableName(e.target.value)}
                  class={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${
                    theme() === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label class={`block text-sm font-medium ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  SQL Dialect
                </label>
                <select
                  value={sqlDialect()}
                  onChange={(e) => setSqlDialect(e.target.value as 'mysql' | 'postgresql' | 'sqlite')}
                  class={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${
                    theme() === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="mysql">MySQL</option>
                  <option value="postgresql">PostgreSQL</option>
                  <option value="sqlite">SQLite</option>
                </select>
              </div>
            </div>

            <Show when={showSqlSettings()}>
              <div class="mt-4 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class={`flex items-center justify-between text-sm font-medium ${
                    theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <span>Max Rows in INSERT</span>
                    <span class={`text-xs ${
                      theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {maxRowsInInsert() === 0 ? 'All rows' : `${maxRowsInInsert()} rows`}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="50"
                    value={maxRowsInInsert()}
                    onInput={(e) => setMaxRowsInInsert(parseInt(e.target.value))}
                    class="mt-2 w-full accent-purple-500"
                  />
                  <div class="flex justify-between text-xs mt-1">
                    <span class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}>All</span>
                    <span class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}>1000 rows</span>
                  </div>
                </div>

                <div>
                  <label class="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={includeNulls()}
                      onChange={(e) => setIncludeNulls(e.target.checked)}
                      class={`h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 ${
                        theme() === 'dark' ? 'bg-gray-700 border-gray-600' : ''
                      }`}
                    />
                    <span class={`text-sm font-medium ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Include NULL values in SQL
                    </span>
                  </label>
                  <p class={`mt-1 text-xs ${
                    theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {includeNulls() 
                      ? 'Empty values will be inserted as NULL' 
                      : 'Empty values will be inserted as empty strings (\'\')'}
                  </p>
                </div>
                
                <div>
                  <label class={`block text-sm font-medium ${
                    theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Insert Mode
                  </label>
                  <select
                    value={insertMode()}
                    onChange={(e) => setInsertMode(e.target.value as 'single' | 'batch' | 'multiple')}
                    class={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${
                      theme() === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="batch">Batch Insert (50 rows per statement)</option>
                    <option value="multiple">Single Insert with Multiple Values</option>
                    <option value="single">Individual Insert Statements</option>
                  </select>
                  <p class={`mt-1 text-xs ${
                    theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {insertMode() === 'batch' && 'Inserts rows in batches of 50 for better performance'}
                    {insertMode() === 'multiple' && 'Creates one INSERT statement with multiple VALUES'}
                    {insertMode() === 'single' && 'Creates separate INSERT statement for each row'}
                  </p>
                </div>
              </div>
            </Show>

            <div class="flex space-x-2 mt-4">
              <button
                onClick={generateSQL}
                class={`flex-1 px-4 py-2 rounded-md font-semibold transition-all flex items-center justify-center space-x-2 ${
                  theme() === 'dark'
                    ? 'bg-purple-700 text-white hover:bg-purple-600'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                <Database class="w-5 h-5" />
                <span>Generate SQL</span>
              </button>
            </div>

            {/* SQL Output */}
            <Show when={generatedSQL().create || generatedSQL().insert}>
              <div class="mt-4 p-4 rounded-lg border overflow-hidden">
                <div class="flex items-center justify-between mb-4">
                  <h3 class={`text-sm font-medium ${
                    theme() === 'dark' ? 'text-gray-300' : 'text-gray-800'
                  }`}>
                    Generated SQL
                  </h3>
                  <div class="flex space-x-2">
                    <button
                      onClick={copyAllSQL}
                      class={`px-3 py-1 rounded-md text-sm font-semibold transition-all flex items-center space-x-2 ${
                        theme() === 'dark'
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      }`}
                    >
                      <Copy class="w-4 h-4" />
                      <span>Copy All</span>
                    </button>
                    <button
                      onClick={downloadSQL}
                      class={`px-3 py-1 rounded-md text-sm font-semibold transition-all flex items-center space-x-2 ${
                        theme() === 'dark'
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      }`}
                    >
                      <Download class="w-4 h-4" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* CREATE TABLE Section */}
                <div class={`p-4 rounded-lg mb-4 ${
                  theme() === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <div class="flex items-center justify-between mb-2">
                    <h4 class={`text-xs font-medium uppercase tracking-wide ${
                      theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      CREATE TABLE Statement
                    </h4>
                    <button
                      onClick={() => copyToClipboard(generatedSQL().create, 'CREATE TABLE SQL copied!')}
                      class={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${
                        theme() === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Copy class="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <div class={`mt-2 rounded-md ${
                    theme() === 'dark' ? 'bg-gray-900' : 'bg-white'
                  }`}>
                    <pre class={`p-4 text-sm font-mono overflow-x-auto whitespace-pre ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-800'
                    }`}>
                      {generatedSQL().create}
                    </pre>
                  </div>
                </div>

                {/* INSERT INTO Section */}
                <div class={`p-4 rounded-lg ${
                  theme() === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <div class="flex items-center justify-between mb-2">
                    <h4 class={`text-xs font-medium uppercase tracking-wide ${
                      theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      INSERT Statements
                    </h4>
                    <button
                      onClick={() => copyToClipboard(generatedSQL().insert, 'INSERT statements copied!')}
                      class={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${
                        theme() === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Copy class="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <div class={`mt-2 rounded-md ${
                    theme() === 'dark' ? 'bg-gray-900' : 'bg-white'
                  }`}>
                    <pre class={`p-4 text-sm font-mono overflow-x-auto whitespace-pre ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-800'
                    }`}>
                      {generatedSQL().insert}
                    </pre>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Large File Warning */}
      <Show when={isLargeFile()}>
        <div class={`rounded-lg shadow-sm border p-4 mb-2 ${
          theme() === 'dark' ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-400'
        }`}>
          <div class="flex items-center">
            <AlertCircle class={`h-5 w-5 mr-2 ${theme() === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} />
            <span class={`text-sm ${theme() === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
              Warning: This file is large ({fileSizeMB()} MB). Processing may be slow and could impact browser performance.
            </span>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default DataTypeCSV;

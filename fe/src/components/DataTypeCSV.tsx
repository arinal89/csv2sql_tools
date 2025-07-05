import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Upload, Download, Type, AlertCircle, CheckCircle } from 'lucide-solid';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';
import { determineDataTypes } from '../services/api';

interface ColumnInfo {
  name: string;
  detectedType: string;
  selectedType: string;
  sampleValues: string[];
  nullCount: number;
  totalCount: number;
}

const DataTypeCSV: Component = () => {
  const { theme } = useTheme();
  const [csvData, setCsvData] = createSignal<any[][] | null>(null);
  const [headers, setHeaders] = createSignal<string[]>([]);
  const [columnInfo, setColumnInfo] = createSignal<ColumnInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');

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

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    
    try {
      // Call Python backend API to determine data types
      const result = await determineDataTypes(file);
      
      if (result && result.typeInfo) {
        // Set preview data
        if (result.previewData && result.previewData.length > 0) {
          const headers = Object.keys(result.previewData[0]);
          const data = result.previewData.map((row: any) => 
            headers.map(header => row[header])
          );
          
          setHeaders(headers);
          setCsvData(data);
          
          // Set column info based on returned type information
          const columns: ColumnInfo[] = headers.map(header => {
            const info = result.typeInfo[header];
            return {
              name: header,
              detectedType: info.detected.toUpperCase(),
              selectedType: info.detected.toUpperCase(),
              sampleValues: data.slice(0, 5).map(row => 
                row[headers.indexOf(header)]?.toString() || ''
              ),
              nullCount: info.nullCount || 0,
              totalCount: result.rowCount
            };
          });
          
          setColumnInfo(columns);
          setSuccess(`Data types analyzed successfully! ${headers.length} columns detected.`);
        } else {
          throw new Error('No preview data returned from server');
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      setError(`Error analyzing data types: ${err.message}`);
    } finally {
      setLoading(false);
    }
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

  return (
    <div class="w-full space-y-6">
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
            <button
              onClick={downloadTypedCSV}
              class="btn btn-primary btn-sm"
            >
              <Download class="w-4 h-4 mr-2" />
              Download Typed CSV
            </button>
          </div>

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
                        <select
                          value={column.selectedType}
                          onChange={(e) => updateColumnType(index(), e.target.value)}
                          class={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm ${
                            theme() === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        >
                          <For each={dataTypes}>
                            {(type) => (
                              <option value={type}>{type}</option>
                            )}
                          </For>
                        </select>
                      </td>
                      <td class="px-6 py-4 text-sm">
                        <div class="max-w-xs">
                          {column.sampleValues.slice(0, 3).map(value => (
                            <div class={`truncate text-xs ${
                              theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>{value}</div>
                          ))}
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
                }`}>All data types are valid!</span>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Messages */}
      <Show when={error()}>
        <div class={`border rounded-lg p-4 ${
          theme() === 'dark' 
            ? 'bg-red-900/20 border-red-800' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div class="flex items-center">
            <AlertCircle class={`w-5 h-5 mr-3 ${
              theme() === 'dark' ? 'text-red-400' : 'text-red-600'
            }`} />
            <span class={theme() === 'dark' ? 'text-red-300' : 'text-red-800'}>
              {error()}
            </span>
          </div>
        </div>
      </Show>

      <Show when={success()}>
        <div class={`border rounded-lg p-4 ${
          theme() === 'dark' 
            ? 'bg-green-900/20 border-green-800' 
            : 'bg-green-50 border-green-200'
        }`}>
          <div class="flex items-center">
            <CheckCircle class={`w-5 h-5 mr-3 ${
              theme() === 'dark' ? 'text-green-400' : 'text-green-600'
            }`} />
            <span class={theme() === 'dark' ? 'text-green-300' : 'text-green-800'}>
              {success()}
            </span>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default DataTypeCSV;

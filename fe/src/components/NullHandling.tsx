import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Upload, Download, Shield, AlertCircle, CheckCircle, BarChart3 } from 'lucide-solid';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';
import { handleNulls } from '../services/api';

interface ColumnStats {
  name: string;
  totalRows: number;
  nullCount: number;
  nullPercentage: number;
  nullTypes: string[];
  sampleValues: any[];
}

interface NullHandlingConfig {
  strategy: 'remove' | 'replace' | 'keep';
  defaultValue: string;
  removeRowsWithAnyNull: boolean;
  removeRowsWithAllNull: boolean;
}

const NullHandling: Component = () => {
  const { theme } = useTheme();
  const [csvData, setCsvData] = createSignal<{ headers: string[]; data: any[][] } | null>(null);
  const [columnStats, setColumnStats] = createSignal<ColumnStats[]>([]);
  const [processedData, setProcessedData] = createSignal<any[][] | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [fileName, setFileName] = createSignal('');
  
  const [globalConfig, setGlobalConfig] = createSignal<NullHandlingConfig>({
    strategy: 'replace',
    defaultValue: '',
    removeRowsWithAnyNull: false,
    removeRowsWithAllNull: true
  });

  const [columnConfigs, setColumnConfigs] = createSignal<Map<string, NullHandlingConfig>>(new Map());

  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setFileName(file.name);

    Papa.parse(file, {
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            setError(`CSV parsing error: ${results.errors[0].message}`);
            setLoading(false);
            return;
          }

          const data = results.data as any[][];
          if (data.length === 0) {
            setError('CSV file is empty');
            setLoading(false);
            return;
          }

          const headers = data[0] as string[];
          const rows = data.slice(1);

          setCsvData({ headers, data: rows });
          analyzeNullValues(headers, rows);
          
          setLoading(false);
          setSuccess('File analyzed successfully!');
        } catch (err) {
          setError(`Error processing file: ${err}`);
          setLoading(false);
        }
      },
      header: false,
      skipEmptyLines: false,
      transformHeader: (header) => header.trim(),
      transform: (value) => {
        // Don't transform values to preserve null detection
        return value;
      }
    });
  };

  const isNullValue = (value: any): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      return trimmed === '' || 
             trimmed === 'null' || 
             trimmed === 'na' || 
             trimmed === 'n/a' || 
             trimmed === 'none' || 
             trimmed === 'nil' ||
             trimmed === '#n/a' ||
             trimmed === '#null';
    }
    return false;
  };

  const analyzeNullValues = (headers: string[], rows: any[][]) => {
    const stats: ColumnStats[] = headers.map((header, colIndex) => {
      const columnValues = rows.map(row => row[colIndex]);
      const nullValues = columnValues.filter(isNullValue);
      const nonNullValues = columnValues.filter(v => !isNullValue(v));
      
      const nullTypes = [...new Set(nullValues.map(v => {
        if (v === null || v === undefined) return 'undefined';
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed === '') return 'empty string';
          return trimmed.toLowerCase();
        }
        return String(v);
      }))];

      return {
        name: header,
        totalRows: rows.length,
        nullCount: nullValues.length,
        nullPercentage: Math.round((nullValues.length / rows.length) * 100),
        nullTypes,
        sampleValues: nonNullValues.slice(0, 5)
      };
    });

    setColumnStats(stats);

    // Initialize column configs
    const configs = new Map<string, NullHandlingConfig>();
    headers.forEach(header => {
      configs.set(header, { ...globalConfig() });
    });
    setColumnConfigs(configs);
  };

  // Function to update individual column configuration (reserved for future use)
  // const updateColumnConfig = (columnName: string, config: Partial<NullHandlingConfig>) => {
  //   const configs = new Map(columnConfigs());
  //   const currentConfig = configs.get(columnName) || { ...globalConfig() };
  //   configs.set(columnName, { ...currentConfig, ...config });
  //   setColumnConfigs(configs);
  // };

  const applyGlobalConfig = () => {
    const global = globalConfig();
    const configs = new Map<string, NullHandlingConfig>();
    columnStats().forEach(stat => {
      configs.set(stat.name, { ...global });
    });
    setColumnConfigs(configs);
  };

  const processNulls = async () => {
    const data = csvData();
    if (!data) {
      setError('No data to process');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Convert data format for API
      const apiData = data.data.map((row, rowIndex) => {
        const obj: Record<string, any> = {};
        data.headers.forEach((header, colIndex) => {
          obj[header] = row[colIndex];
        });
        return obj;
      });

      // Get the current global strategy
      const config = globalConfig();
      
      // Map our UI strategy names to backend strategy names
      let strategy = 'value';
      let fillValue = '';
      
      if (config.strategy === 'remove') {
        strategy = 'drop';
      } else if (config.strategy === 'replace') {
        strategy = 'value';
        fillValue = config.defaultValue;
      } else {
        // 'keep' strategy - we'll just return the data as is
        const headers = data.headers;
        setProcessedData(data.data);
        setSuccess('Null values kept as is');
        setLoading(false);
        return;
      }
      
      // Call Python backend API
      const result = await handleNulls(apiData, strategy, undefined, fillValue);
      
      if (result && result.processedData) {
        // Extract data from the processed result
        const processedRecords = result.processedData;
        
        if (processedRecords.length > 0) {
          const headers = Object.keys(processedRecords[0]);
          const processedRows = processedRecords.map((record: any) => 
            headers.map(header => record[header])
          );
          
          setProcessedData(processedRows);
          setSuccess(`Null values handled successfully! ${result.rowCount} rows processed.`);
        } else {
          setProcessedData([]);
          setSuccess('Data processed, but no rows were returned.');
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      setError(`Error handling null values: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadProcessedCSV = () => {
    const data = processedData();
    const headers = csvData()?.headers;
    if (!data || !headers) return;

    const csvContent = [
      headers.join(','),
      ...data.map(row => 
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
    a.download = `processed_${fileName()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('Processed CSV downloaded!');
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
            theme() === 'dark' ? 'bg-orange-900/50' : 'bg-orange-100'
          }`}>
            <Shield class={`w-6 h-6 ${
              theme() === 'dark' ? 'text-orange-400' : 'text-orange-600'
            }`} />
          </div>
          <div>
            <h1 class={`text-2xl font-bold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              NULL Handling
            </h1>
            <p class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Detect and handle NULL values in your CSV data
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div class={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          theme() === 'dark' 
            ? 'border-gray-600 hover:border-orange-500' 
            : 'border-gray-300 hover:border-orange-400'
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
                    ? 'text-gray-300 file:bg-orange-900/50 file:text-orange-300 hover:file:bg-orange-900/70'
                    : 'text-gray-500 file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100'
                }`}
              />
            </label>
            <p class={`text-sm ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {loading() ? 'Analyzing NULL values...' : 'Upload a CSV file to analyze NULL values'}
            </p>
          </div>
        </div>
      </div>

      {/* NULL Statistics */}
      <Show when={columnStats().length > 0}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center space-x-3 mb-4">
            <BarChart3 class={`w-5 h-5 ${
              theme() === 'dark' ? 'text-orange-400' : 'text-orange-600'
            }`} />
            <h2 class={`text-lg font-semibold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              NULL Value Statistics
            </h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={columnStats()}>
              {(stat) => (
                <div class={`border rounded-lg p-4 ${
                  theme() === 'dark' ? 'border-gray-600' : 'border-gray-200'
                }`}>
                  <h3 class={`font-semibold mb-2 ${
                    theme() === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>{stat.name}</h3>
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <span class={`text-sm ${
                        theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>Total Rows:</span>
                      <span class={`text-sm font-medium ${
                        theme() === 'dark' ? 'text-gray-200' : 'text-gray-900'
                      }`}>{stat.totalRows}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class={`text-sm ${
                        theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>NULL Count:</span>
                      <span class={`text-sm font-medium ${
                        theme() === 'dark' ? 'text-red-400' : 'text-red-600'
                      }`}>{stat.nullCount}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class={`text-sm ${
                        theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>NULL %:</span>
                      <span class={`text-sm font-medium ${
                        theme() === 'dark' ? 'text-red-400' : 'text-red-600'
                      }`}>{stat.nullPercentage}%</span>
                    </div>
                    <Show when={stat.nullTypes.length > 0}>
                      <div>
                        <span class={`text-sm ${
                          theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>NULL Types:</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                          <For each={stat.nullTypes}>
                            {(type) => (
                              <span class={`text-xs px-2 py-1 rounded ${
                                theme() === 'dark' ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-800'
                              }`}>
                                {type}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Global Configuration */}
      <Show when={columnStats().length > 0}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <h2 class={`text-lg font-semibold mb-4 ${
            theme() === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Global NULL Handling Configuration
          </h2>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class={`block text-sm font-medium mb-2 ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Default Strategy
                </label>
                <select
                  value={globalConfig().strategy}
                  onChange={(e) => setGlobalConfig(prev => ({ ...prev, strategy: e.target.value as any }))}
                  class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    theme() === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="replace">Replace with default value</option>
                  <option value="keep">Keep as is</option>
                  <option value="remove">Remove (empty string)</option>
                </select>
              </div>

              <div>
                <label class={`block text-sm font-medium mb-2 ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Default Value (for replace strategy)
                </label>
                <input
                  type="text"
                  value={globalConfig().defaultValue}
                  onInput={(e) => setGlobalConfig(prev => ({ ...prev, defaultValue: e.target.value }))}
                  class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    theme() === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="Enter default value"
                />
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="removeAnyNull"
                  checked={globalConfig().removeRowsWithAnyNull}
                  onChange={(e) => setGlobalConfig(prev => ({ ...prev, removeRowsWithAnyNull: e.target.checked }))}
                  class="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label for="removeAnyNull" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Remove rows with any NULL values
                </label>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="removeAllNull"
                  checked={globalConfig().removeRowsWithAllNull}
                  onChange={(e) => setGlobalConfig(prev => ({ ...prev, removeRowsWithAllNull: e.target.checked }))}
                  class="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label for="removeAllNull" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Remove rows where all values are NULL
                </label>
              </div>
            </div>

            <div class="flex space-x-2">
              <button
                onClick={applyGlobalConfig}
                class="btn btn-outline btn-sm"
              >
                Apply to All Columns
              </button>
              <button
                onClick={processNulls}
                disabled={loading()}
                class="btn btn-primary btn-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading() ? 'Processing...' : 'Process NULL Values'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Processed Data Preview */}
      <Show when={processedData()}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <h2 class={`text-lg font-semibold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Processed Data Preview
            </h2>
            <button
              onClick={downloadProcessedCSV}
              class="btn btn-primary btn-sm"
            >
              <Download class="w-4 h-4 mr-2" />
              Download Processed CSV
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class={theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <For each={csvData()?.headers}>
                    {(header) => (
                      <th class={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        theme() === 'dark' ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        {header}
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody class={`divide-y ${
                theme() === 'dark' 
                  ? 'bg-gray-800 divide-gray-700' 
                  : 'bg-white divide-gray-200'
              }`}>
                <For each={processedData()?.slice(0, 10)}>
                  {(row) => (
                    <tr>
                      <For each={row}>
                        {(cell) => (
                          <td class={`px-6 py-4 whitespace-nowrap text-sm ${
                            theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                          }`}>
                            {cell === '' ? 
                              <span class={`italic ${
                                theme() === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              }`}>empty</span> : cell
                            }
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          <Show when={processedData() && processedData()!.length > 10}>
            <p class={`text-sm mt-2 ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Showing first 10 rows of {processedData()!.length} total processed rows
            </p>
          </Show>
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

export default NullHandling;

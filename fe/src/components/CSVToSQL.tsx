import { createSignal, Show, onCleanup } from 'solid-js';
import type { Component } from 'solid-js';
import { Upload, Download, Copy, FileText, AlertCircle, CheckCircle, Maximize2, Minimize2 } from 'lucide-solid';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';
import { csvToSQL } from '../services/api';

interface CSVData {
  headers: string[];
  data: any[][];
  fileName: string;
}

const CSVToSQL: Component = () => {
  const { theme } = useTheme();
  const [csvData, setCsvData] = createSignal<CSVData | null>(null);
  const [tableName, setTableName] = createSignal('');
  const [outputFileName, setOutputFileName] = createSignal('');
  const [batchSize, setBatchSize] = createSignal(1000);
  const [sqlResult, setSqlResult] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [progress, setProgress] = createSignal(0);
  const [expandedSQL, setExpandedSQL] = createSignal(false);
  let progressInterval: NodeJS.Timeout | null = null;

  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

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
          const rows = data.slice(1).filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

          setCsvData({
            headers,
            data: rows,
            fileName: file.name.replace('.csv', '')
          });

          if (!tableName()) {
            setTableName(file.name.replace('.csv', '').toLowerCase().replace(/[^a-z0-9]/g, '_'));
          }

          if (!outputFileName()) {
            setOutputFileName(file.name.replace('.csv', ''));
          }

          setLoading(false);
        } catch (err) {
          setError(`Error processing file: ${err}`);
          setLoading(false);
        }
      },
      header: false,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim()
    });
  };

  const simulateProgress = () => {
    setProgress(0);
    // Clear any existing interval
    if (progressInterval) {
      clearInterval(progressInterval);
    }
    
    progressInterval = setInterval(() => {
      setProgress((prev) => {
        // Move faster at the beginning, slower as we approach 95%
        const increment = prev < 50 ? 8 : (prev < 80 ? 4 : 1);
        // Only go up to 95% in simulation, the last 5% will be set when API call completes
        if (prev >= 95) {
          clearInterval(progressInterval!);
          return 95;
        }
        return prev + increment;
      });
    }, 300); // Update more frequently (300ms)
  };

  onCleanup(() => {
    if (progressInterval) clearInterval(progressInterval);
  });

  const generateSQL = () => {
    const data = csvData();
    if (!data || !tableName()) return;

    setLoading(true);
    setError('');
    setSuccess('');
    simulateProgress(); // Start simulating progress

    try {
      // Convert data format for API
      const apiData = data.data.map((row) => {
        const obj: Record<string, any> = {};
        data.headers.forEach((header, colIndex) => {
          obj[header] = row[colIndex];
        });
        return obj;
      });
      
      // Call Python backend API
      csvToSQL(apiData, tableName(), batchSize())
        .then(response => {
          // Set progress to almost complete
          setProgress(98);
          
          // Combine create table and insert statements
          const fullSQL = [
            '-- Table creation',
            response.createTableStatement,
            '',
            '-- Data insertion',
            ...response.insertStatements
          ].join('\n');
          
          setSqlResult(fullSQL);
          
          // Create success message and append warning if present
          let successMsg = 'SQL generated successfully!';
          if (response.warning) {
            successMsg += ` (Note: ${response.warning})`;
          }
          setSuccess(successMsg);
          
          // Complete the progress and delay closing the loading popup slightly
          // to ensure the user sees the 100% completion
          setProgress(100);
          setTimeout(() => {
            setLoading(false);
          }, 500);
        })
        .catch(err => {
          setError(`Error generating SQL: ${err.message}`);
          if (progressInterval) clearInterval(progressInterval);
          setLoading(false);
        })
        .finally(() => {
          // Clear the interval if it's still running
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        });
    } catch (err: any) {
      setError(`Error processing data: ${err.message}`);
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      setLoading(false);
      setProgress(0);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sqlResult());
      setSuccess('SQL copied to clipboard!');
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const downloadSQL = () => {
    const blob = new Blob([sqlResult()], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${outputFileName() || tableName() || 'table'}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('SQL file downloaded!');
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
            theme() === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
          }`}>
            <FileText class={`w-6 h-6 ${
              theme() === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
          </div>
          <div>
            <h1 class={`text-2xl font-bold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              CSV to SQL Converter
            </h1>
            <p class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Convert your CSV files to SQL CREATE TABLE and INSERT statements
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div class={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          theme() === 'dark' 
            ? 'border-gray-600 hover:border-blue-500' 
            : 'border-gray-300 hover:border-blue-400'
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
                class={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold transition-colors ${
                  theme() === 'dark'
                    ? 'text-gray-300 file:bg-blue-900/50 file:text-blue-300 hover:file:bg-blue-900/70'
                    : 'text-gray-500 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
                }`}
              />
            </label>
            <p class={`text-sm ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Drag and drop your CSV file here, or click to browse
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <Show when={csvData()}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <h2 class={`text-lg font-semibold mb-4 ${
            theme() === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Configuration
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class={`block text-sm font-medium mb-2 ${
                theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Table Name
              </label>
              <input
                type="text"
                value={tableName()}
                onInput={(e) => setTableName(e.target.value)}
                class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme() === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter table name"
              />
            </div>

            <div>
              <label class={`block text-sm font-medium mb-2 ${
                theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Output File Name
              </label>
              <input
                type="text"
                value={outputFileName()}
                onInput={(e) => setOutputFileName(e.target.value)}
                class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme() === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter output file name (without .sql)"
              />
            </div>

            <div>
              <label class={`block text-sm font-medium mb-2 ${
                theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Batch Size
              </label>
              <select
                value={batchSize()}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme() === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value={1}>Single INSERT per row</option>
                <option value={100}>100 rows per batch</option>
                <option value={500}>500 rows per batch</option>
                <option value={1000}>1000 rows per batch</option>
                <option value={5000}>5000 rows per batch</option>
              </select>
              <p class={`text-xs mt-1 ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Larger batches are more efficient but may exceed database limits
              </p>
            </div>

            <div class="flex items-end">
              <button
                onClick={generateSQL}
                disabled={loading() || !tableName()}
                class="btn btn-primary btn-md w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading() ? 'Generating...' : 'Generate SQL'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Data Preview */}
      <Show when={csvData()}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <h2 class={`text-lg font-semibold mb-4 ${
            theme() === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Data Preview
          </h2>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class={theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  {csvData()?.headers.map((header) => (
                    <th class={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody class={`divide-y ${
                theme() === 'dark' 
                  ? 'bg-gray-800 divide-gray-700' 
                  : 'bg-white divide-gray-200'
              }`}>
                {csvData()?.data.slice(0, 5).map((row) => (
                  <tr>
                    {row.map((cell) => (
                      <td class={`px-6 py-4 whitespace-nowrap text-sm ${
                        theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                      }`}>
                        {cell || 'NULL'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Show when={csvData() && csvData()!.data.length > 5}>
            <p class={`text-sm mt-2 ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Showing first 5 rows of {csvData()!.data.length} total rows
            </p>
          </Show>
        </div>
      </Show>

      {/* SQL Result */}
      <Show when={sqlResult()}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class={`text-lg font-semibold ${
                theme() === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Generated SQL
              </h2>
              <p class={`text-sm ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Table: {tableName()} • File: {outputFileName() || tableName()}.sql • 
                Batch Size: {batchSize() === 1 ? 'Single INSERTs' : `${batchSize()} rows per batch`}
              </p>
            </div>
            <div class="flex space-x-2">
              <button
                onClick={copyToClipboard}
                class="btn btn-outline btn-sm"
              >
                <Copy class="w-4 h-4 mr-2" />
                Copy
              </button>
              <button
                onClick={downloadSQL}
                class="btn btn-primary btn-sm"
              >
                <Download class="w-4 h-4 mr-2" />
                Download
              </button>
            </div>
          </div>
          <div class="relative">
            <div class={`absolute right-2 top-2 z-10 ${expandedSQL() ? 'flex' : 'hidden'}`}>
              <button
                onClick={() => setExpandedSQL(false)}
                class={`p-1 rounded-md ${
                  theme() === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title="Collapse SQL view"
              >
                <Minimize2 class="w-4 h-4" />
              </button>
            </div>
            <pre 
              class={`border rounded-lg p-4 text-sm ${
                theme() === 'dark' 
                  ? 'bg-gray-900 border-gray-600 text-gray-300' 
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              } ${
                expandedSQL() 
                  ? 'h-auto max-h-none overflow-visible' 
                  : 'h-60 overflow-auto'
              }`}
            >
              <code>{sqlResult()}</code>
            </pre>
            <div class={`flex justify-center mt-2 ${expandedSQL() ? 'hidden' : ''}`}>
              <button
                onClick={() => setExpandedSQL(true)}
                class={`flex items-center text-sm px-3 py-1 rounded-md ${
                  theme() === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Maximize2 class="w-4 h-4 mr-1" />
                Show full SQL
              </button>
            </div>
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

      {/* Loading Popup */}
      <Show when={loading()}>
        <div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div class="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
            <div class="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div
                class="absolute top-0 left-0 h-full bg-blue-500 transition-all"
                style={{ width: `${progress()}%` }}
              ></div>
            </div>
            <p class="text-gray-700 text-sm">
              Generating SQL, please wait... {progress()}%
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default CSVToSQL;

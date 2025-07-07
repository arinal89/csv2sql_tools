import { createSignal, Show, For, onCleanup, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { Upload, Download, Settings, AlertCircle, CheckCircle, X, FileText, Eye, Search, BarChart3, Trash2, RefreshCw } from 'lucide-solid';
import { useTheme } from '../contexts/ThemeContext';
import Papa from 'papaparse';
import { normalizeCSV } from '../services/api';

interface CSVFile {
  name: string;
  data: any[][];
  headers: string[];
  size: number;
  status: 'loading' | 'success' | 'error';
  errorMessage?: string;
  lastModified?: number;
  encoding?: string;
  delimiter?: string;
}

interface NormalizationStats {
  originalRows: number;
  processedRows: number;
  duplicatesRemoved: number;
  emptyRowsRemoved: number;
  columnsStandardized: number;
  dataIssuesFixed: number;
}

const NormalizeCSV: Component = () => {
  const { theme } = useTheme();
  const [csvFiles, setCsvFiles] = createSignal<CSVFile[]>([]);
  const [normalizedData, setNormalizedData] = createSignal<any[][] | null>(null);
  const [normalizedHeaders, setNormalizedHeaders] = createSignal<string[]>([]);
  const [previewFile, setPreviewFile] = createSignal<CSVFile | null>(null);
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [progress, setProgress] = createSignal(0);
  const [removeDuplicates, setRemoveDuplicates] = createSignal(true);
  const [trimWhitespace, setTrimWhitespace] = createSignal(true);
  const [standardizeHeaders, setStandardizeHeaders] = createSignal(true);
  const [removeEmptyRows, setRemoveEmptyRows] = createSignal(true);
  const [convertEncoding, setConvertEncoding] = createSignal(false);
  const [fixDataTypes, setFixDataTypes] = createSignal(true);
  const [validateEmails, setValidateEmails] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal('');
  const [showStats, setShowStats] = createSignal(false);
  const [normalizationStats, setNormalizationStats] = createSignal<NormalizationStats | null>(null);
  const [showNormalizationOptions, setShowNormalizationOptions] = createSignal(true);
  let progressInterval: NodeJS.Timeout | null = null;
  
  onCleanup(() => {
    if (progressInterval) clearInterval(progressInterval);
  });

  // Create filtered data memo for search functionality
  const filteredNormalizedData = createMemo(() => {
    const data = normalizedData();
    const search = searchTerm().toLowerCase();
    
    if (!data || !search) return data;
    
    return data.filter(row => 
      row.some(cell => 
        String(cell || '').toLowerCase().includes(search)
      )
    );
  });

  // Function to highlight search terms in text
  const highlightSearchTerm = (text: string) => {
    const search = searchTerm().toLowerCase();
    if (!search) return text;
    
    const index = text.toLowerCase().indexOf(search);
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <span class={`font-semibold ${
          theme() === 'dark' ? 'bg-yellow-600 text-yellow-100' : 'bg-yellow-200 text-yellow-800'
        }`}>
          {text.substring(index, index + search.length)}
        </span>
        {text.substring(index + search.length)}
      </>
    );
  };

  const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;

    await processFiles(files);
  };

  const processFiles = async (files: FileList) => {
    setLoading(true);
    setError('');

    try {
      const filePromises = Array.from(files).map(file => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
          return Promise.reject(new Error(`${file.name} is not a CSV file`));
        }
        // No file size limit
        // Note: Very large files may affect performance

        return new Promise<CSVFile>((resolve, reject) => {
          Papa.parse(file, {
            complete: (results) => {
              if (results.errors.length > 0) {
                reject(new Error(`Error parsing ${file.name}: ${results.errors[0].message}`));
                return;
              }

              const data = results.data as any[][];
              if (data.length === 0) {
                reject(new Error(`File ${file.name} is empty`));
                return;
              }

              const headers = data[0] as string[];
              const rows = data.slice(1).filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

              resolve({
                name: file.name,
                data: rows,
                headers: headers,
                size: file.size,
                status: 'success'
              });
            },
            header: false,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            transform: (value) => value.trim()
          });
        });
      });

      const results = await Promise.allSettled(filePromises);
      const successfulFiles: CSVFile[] = [];
      const errors: string[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          successfulFiles.push(result.value);
        } else {
          errors.push(result.reason.message);
        }
      });

      if (successfulFiles.length > 0) {
        setCsvFiles([...csvFiles(), ...successfulFiles]);
        setSuccess(`Successfully loaded ${successfulFiles.length} file(s)`);
      }

      if (errors.length > 0) {
        setError(`Some files failed to load: ${errors.join(', ')}`);
      }

      setLoading(false);
    } catch (err) {
      setError(`Error loading files: ${err}`);
      setLoading(false);
    }
  };

  const removeFile = (index: number) => {
    const files = csvFiles();
    files.splice(index, 1);
    setCsvFiles([...files]);
    setNormalizedData(null);
    setNormalizedHeaders([]);
    if (files.length === 0) {
      setSuccess('');
    } else {
      setSuccess(`${files.length} file(s) remaining`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (files) {
      processFiles(files);
    }
  };

  const standardizeHeader = (header: string): string => {
    return header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
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

  const normalizeData = async () => {
    if (csvFiles().length === 0) {
      setError('No CSV files uploaded');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setNormalizationStats(null);
    simulateProgress(); // Start simulating progress

    try {
      // Get the first file for demonstration purposes
      // In a real app, you might want to handle multiple files differently
      const firstFile = csvFiles()[0];
      
      // Calculate initial statistics
      const initialStats: NormalizationStats = {
        originalRows: firstFile.data.length,
        processedRows: 0,
        duplicatesRemoved: 0,
        emptyRowsRemoved: 0,
        columnsStandardized: 0,
        dataIssuesFixed: 0
      };

      // Perform local normalization based on selected options
      let processedData = [...firstFile.data];
      let processedHeaders = [...firstFile.headers];
      let stats = { ...initialStats };

      // Remove empty rows
      if (removeEmptyRows()) {
        const originalLength = processedData.length;
        processedData = processedData.filter(row => 
          row.some(cell => cell !== null && cell !== undefined && cell !== '')
        );
        stats.emptyRowsRemoved = originalLength - processedData.length;
      }

      // Trim whitespace
      if (trimWhitespace()) {
        processedData = processedData.map(row => 
          row.map(cell => typeof cell === 'string' ? cell.trim() : cell)
        );
        stats.dataIssuesFixed += processedData.length;
      }

      // Remove duplicates
      if (removeDuplicates()) {
        const originalLength = processedData.length;
        const uniqueRows = new Set();
        processedData = processedData.filter(row => {
          const rowKey = row.join('|');
          if (uniqueRows.has(rowKey)) {
            return false;
          }
          uniqueRows.add(rowKey);
          return true;
        });
        stats.duplicatesRemoved = originalLength - processedData.length;
      }

      // Standardize headers
      if (standardizeHeaders()) {
        const originalHeaders = [...processedHeaders];
        processedHeaders = processedHeaders.map(standardizeHeader);
        stats.columnsStandardized = processedHeaders.filter((header, index) => 
          header !== originalHeaders[index]
        ).length;
      }

      // Fix data types
      if (fixDataTypes()) {
        processedData = processedData.map(row => 
          row.map(cell => {
            if (typeof cell === 'string') {
              // Try to convert to number
              const num = parseFloat(cell);
              if (!isNaN(num) && isFinite(num) && cell.trim() !== '') {
                return num;
              }
              // Try to convert to date
              const date = new Date(cell);
              if (!isNaN(date.getTime()) && cell.match(/^\d{4}-\d{2}-\d{2}/) || cell.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
                return date.toISOString().split('T')[0];
              }
            }
            return cell;
          })
        );
        stats.dataIssuesFixed += processedData.length;
      }

      // Validate emails
      if (validateEmails()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        processedData = processedData.map(row => 
          row.map(cell => {
            if (typeof cell === 'string' && cell.includes('@')) {
              if (!emailRegex.test(cell)) {
                // Try to fix common email issues
                const fixed = cell.toLowerCase().replace(/\s+/g, '').replace(/[,;]/g, '');
                if (emailRegex.test(fixed)) {
                  stats.dataIssuesFixed++;
                  return fixed;
                }
              }
            }
            return cell;
          })
        );
      }

      stats.processedRows = processedData.length;

      const file = new File(
        [Papa.unparse({ fields: processedHeaders, data: processedData })], 
        firstFile.name,
        { type: 'text/csv' }
      );

      // Call Python backend API for additional normalization
      const result = await normalizeCSV(file);
      
      // Set progress to almost complete
      setProgress(98);
      
      if (result && result.normalizedData) {
        // Extract headers and data from the normalized result
        const normalizedRecords = result.normalizedData;
        
        if (normalizedRecords.length > 0) {
          const headers = Object.keys(normalizedRecords[0]);
          const data = normalizedRecords.map((record: any) => 
            headers.map(header => record[header])
          );
          
          setNormalizedHeaders(headers);
          setNormalizedData(data);
          
          // Update final statistics
          stats.processedRows = data.length;
          if (showStats()) {
            setNormalizationStats(stats);
          }
          
          // Create success message and append warning if present
          let successMsg = `Data normalized successfully! ${stats.processedRows} rows processed.`;
          if (stats.duplicatesRemoved > 0) successMsg += ` ${stats.duplicatesRemoved} duplicates removed.`;
          if (stats.emptyRowsRemoved > 0) successMsg += ` ${stats.emptyRowsRemoved} empty rows removed.`;
          if (result.warning) {
            successMsg += ` (Note: ${result.warning})`;
          }
          setSuccess(successMsg);
        } else {
          setNormalizedHeaders([]);
          setNormalizedData([]);
          setSuccess('Data normalized, but no rows were returned.');
        }
      } else {
        // If backend fails, use locally processed data
        setNormalizedHeaders(processedHeaders);
        setNormalizedData(processedData);
        
        if (showStats()) {
          setNormalizationStats(stats);
        }
        
        let successMsg = `Data normalized locally! ${stats.processedRows} rows processed.`;
        if (stats.duplicatesRemoved > 0) successMsg += ` ${stats.duplicatesRemoved} duplicates removed.`;
        if (stats.emptyRowsRemoved > 0) successMsg += ` ${stats.emptyRowsRemoved} empty rows removed.`;
        setSuccess(successMsg);
      }
      
      // Complete the progress and delay closing the loading popup
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (err: any) {
      setError(`Error normalizing data: ${err.message}`);
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      setLoading(false);
      setProgress(0);
    } finally {
      // Clear the interval if it's still running
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    }
  };

  const downloadNormalizedCSV = () => {
    const data = normalizedData();
    const headers = normalizedHeaders();
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
    a.download = 'normalized_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess('Normalized CSV downloaded!');
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
            theme() === 'dark' ? 'bg-green-900/50' : 'bg-green-100'
          }`}>
            <Settings class={`w-6 h-6 ${
              theme() === 'dark' ? 'text-green-400' : 'text-green-600'
            }`} />
          </div>
          <div>
            <h1 class={`text-2xl font-bold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Normalize CSV
            </h1>
            <p class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Clean and normalize your CSV data files
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div 
          class={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver() 
              ? (theme() === 'dark' 
                  ? 'border-green-400 bg-green-900/20' 
                  : 'border-green-500 bg-green-50'
                )
              : (theme() === 'dark' 
                  ? 'border-gray-600 hover:border-green-500' 
                  : 'border-gray-300 hover:border-green-400'
                )
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload class={`w-12 h-12 mx-auto mb-4 ${
            theme() === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`} />
          <div class="space-y-2">
            <label class="block">
              <span class="sr-only">Choose CSV files</span>
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileUpload}
                disabled={loading()}
                class={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold transition-colors disabled:opacity-50 ${
                  theme() === 'dark'
                    ? 'text-gray-300 file:bg-green-900/50 file:text-green-300 hover:file:bg-green-900/70'
                    : 'text-gray-500 file:bg-green-50 file:text-green-700 hover:file:bg-green-100'
                }`}
              />
            </label>
            <p class={`text-sm ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {loading() 
                ? 'Processing files...' 
                : isDragOver() 
                  ? 'Drop CSV files here' 
                  : 'Upload one or more CSV files (drag & drop or click to browse)'
              }
            </p>
            <p class={`text-xs ${theme() === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              Files of any size are supported
            </p>
          </div>
        </div>
      </div>

      {/* Normalization Options */}
      <Show when={csvFiles().length > 0}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <h2 class={`text-lg font-semibold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Normalization Options
            </h2>
            <button
              onClick={() => setShowNormalizationOptions(!showNormalizationOptions())}
              class={`p-2 rounded-lg transition-colors ${
                theme() === 'dark' 
                  ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={showNormalizationOptions() ? 'Minimize options' : 'Expand options'}
            >
              {showNormalizationOptions() ? '−' : '+'}
            </button>
          </div>
          
          <Show when={showNormalizationOptions()}>
            <div class="space-y-4">
              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="removeDuplicates"
                  checked={removeDuplicates()}
                  onChange={(e) => setRemoveDuplicates(e.target.checked)}
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label for="removeDuplicates" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Remove duplicate rows
                </label>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="trimWhitespace"
                  checked={trimWhitespace()}
                  onChange={(e) => setTrimWhitespace(e.target.checked)}
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label for="trimWhitespace" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Trim whitespace from cells
                </label>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="standardizeHeaders"
                  checked={standardizeHeaders()}
                  onChange={(e) => setStandardizeHeaders(e.target.checked)}
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label for="standardizeHeaders" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Standardize column headers (lowercase, underscores)
                </label>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="removeEmptyRows"
                  checked={removeEmptyRows()}
                  onChange={(e) => setRemoveEmptyRows(e.target.checked)}
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label for="removeEmptyRows" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Remove empty rows
                </label>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="fixDataTypes"
                  checked={fixDataTypes()}
                  onChange={(e) => setFixDataTypes(e.target.checked)}
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label for="fixDataTypes" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Fix data types (convert strings to numbers/dates where appropriate)
                </label>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="validateEmails"
                  checked={validateEmails()}
                  onChange={(e) => setValidateEmails(e.target.checked)}
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label for="validateEmails" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Validate and fix email addresses
                </label>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="convertEncoding"
                  checked={convertEncoding()}
                  onChange={(e) => setConvertEncoding(e.target.checked)}
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label for="convertEncoding" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Convert encoding to UTF-8
                </label>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="showStats"
                  checked={showStats()}
                  onChange={(e) => setShowStats(e.target.checked)}
                  class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label for="showStats" class={`ml-2 block text-sm ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  Show normalization statistics
                </label>
              </div>

              <button
                onClick={normalizeData}
                disabled={loading()}
                class="btn btn-primary btn-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading() ? 'Normalizing...' : 'Normalize Data'}
              </button>
            </div>
          </Show>
          
          <Show when={!showNormalizationOptions()}>
            <div class={`p-4 rounded-lg ${
              theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <div class="flex items-center space-x-2">
                    <span class={`text-sm font-medium ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      Options enabled:
                    </span>
                    <span class={`text-sm font-bold ${
                      theme() === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {[
                        removeDuplicates() && 'Remove duplicates',
                        trimWhitespace() && 'Trim whitespace',
                        standardizeHeaders() && 'Standardize headers',
                        removeEmptyRows() && 'Remove empty rows',
                        fixDataTypes() && 'Fix data types',
                        validateEmails() && 'Validate emails',
                        convertEncoding() && 'Convert encoding',
                        showStats() && 'Show stats'
                      ].filter(Boolean).length}
                    </span>
                  </div>
                </div>
                <button
                  onClick={normalizeData}
                  disabled={loading()}
                  class="btn btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading() ? 'Normalizing...' : 'Normalize Data'}
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* File List */}
      <Show when={csvFiles().length > 0}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <h2 class={`text-lg font-semibold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Loaded Files ({csvFiles().length})
            </h2>
            <div class="flex items-center space-x-2">
              <button
                onClick={() => {
                  setNormalizedData(null);
                  setNormalizedHeaders([]);
                  setNormalizationStats(null);
                  setSuccess('');
                  setError('');
                }}
                class={`text-sm px-3 py-1 rounded-md transition-colors ${
                  theme() === 'dark' 
                    ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                    : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                }`}
                title="Clear results"
              >
                <RefreshCw class="w-4 h-4 inline mr-1" />
                Reset
              </button>
              <button
                onClick={() => setCsvFiles([])}
                class={`text-sm px-3 py-1 rounded-md transition-colors ${
                  theme() === 'dark' 
                    ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                    : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                }`}
                title="Remove all files"
              >
                <Trash2 class="w-4 h-4 inline mr-1" />
                Clear All
              </button>
            </div>
          </div>
          <div class="space-y-3">
            <For each={csvFiles()}>
              {(file, index) => (
                <div class={`flex items-center justify-between p-4 rounded-lg border ${
                  theme() === 'dark' 
                    ? 'bg-gray-700 border-gray-600' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div class="flex items-center space-x-3">
                    <FileText class={`w-5 h-5 ${
                      theme() === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                    <div class="flex-1">
                      <p class={`font-medium ${
                        theme() === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{file.name}</p>
                      <p class={`text-sm ${
                        theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {file.data.length.toLocaleString()} rows • {file.headers.length} columns • {formatFileSize(file.size)}
                      </p>
                      <div class="mt-2">
                        <p class={`text-xs font-medium mb-1 ${
                          theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>Column names:</p>
                        <div class="flex flex-wrap gap-1">
                          <For each={file.headers}>
                            {(header) => (
                              <span class={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                                theme() === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {header}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center space-x-2">
                    <button
                      onClick={() => setPreviewFile(file)}
                      class={`p-1 rounded-md transition-colors ${
                        theme() === 'dark' 
                          ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-900/20' 
                          : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                      }`}
                      title="Preview file"
                    >
                      <Eye class="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeFile(index())}
                      class={`p-1 rounded-md transition-colors ${
                        theme() === 'dark' 
                          ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                          : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                      }`}
                      title="Remove file"
                    >
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Column Mapping Preview - Show only when multiple files are loaded */}
      <Show when={csvFiles().length > 1}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <h2 class={`text-lg font-semibold mb-4 ${
            theme() === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Column Mapping Preview</h2>
          <div class={`text-sm mb-4 ${
            theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            When merging multiple files, columns will be mapped based on the headers from the first file. 
            Below shows how each file's columns will be mapped:
          </div>
          
          <div class="space-y-4">
            <For each={csvFiles()}>
              {(file, index) => {
                const baseHeaders = standardizeHeaders() 
                  ? csvFiles()[0].headers.map(standardizeHeader)
                  : csvFiles()[0].headers;
                const currentHeaders = standardizeHeaders() 
                  ? file.headers.map(standardizeHeader)
                  : file.headers;
                
                return (
                  <div class={`border rounded-lg p-4 ${
                    theme() === 'dark' ? 'border-gray-600' : 'border-gray-200'
                  }`}>
                    <div class="flex items-center mb-3">
                      <FileText class={`w-4 h-4 mr-2 ${
                        theme() === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`} />
                      <span class={`font-medium ${
                        theme() === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{file.name}</span>
                      <Show when={index() === 0}>
                        <span class={`ml-2 px-2 py-1 text-xs rounded-full ${
                          theme() === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                        }`}>
                          Base File
                        </span>
                      </Show>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p class={`text-xs font-medium mb-2 ${
                          theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>Original Columns:</p>
                        <div class="flex flex-wrap gap-1">
                          <For each={file.headers}>
                            {(header) => (
                              <span class={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                                theme() === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {header}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                      
                      <div>
                        <p class={`text-xs font-medium mb-2 ${
                          theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>Mapped Columns:</p>
                        <div class="flex flex-wrap gap-1">
                          <For each={currentHeaders}>
                            {(header) => {
                              const isMapped = baseHeaders.includes(header);
                              return (
                                <span class={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                                  isMapped 
                                    ? (theme() === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700')
                                    : (theme() === 'dark' ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700')
                                }`}>
                                  {header}
                                  <Show when={!isMapped}>
                                    <span class="ml-1 text-xs">✗</span>
                                  </Show>
                                </span>
                              );
                            }}
                          </For>
                        </div>
                      </div>
                    </div>
                    
                    <Show when={index() > 0}>
                      <div class={`mt-3 pt-3 border-t ${
                        theme() === 'dark' ? 'border-gray-600' : 'border-gray-100'
                      }`}>
                        <div class={`text-xs ${
                          theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <span class="font-medium">Matching columns:</span> {
                            currentHeaders.filter(h => baseHeaders.includes(h)).length
                          } of {currentHeaders.length}
                          {currentHeaders.some(h => !baseHeaders.includes(h)) && (
                            <span class={`ml-2 ${
                              theme() === 'dark' ? 'text-orange-400' : 'text-orange-600'
                            }`}>
                              • Some columns will be empty in merged data
                            </span>
                          )}
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
          
          <div class={`mt-4 p-3 rounded-lg ${
            theme() === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
          }`}>
            <p class={`text-sm ${
              theme() === 'dark' ? 'text-blue-300' : 'text-blue-800'
            }`}>
              <strong>Note:</strong> The merged file will use the column structure from the first file. 
              Columns that don't match will be filled with empty values.
            </p>
          </div>
        </div>
      </Show>

      {/* File Preview Modal */}
      <Show when={previewFile()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div class={`rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden ${
            theme() === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div class={`flex items-center justify-between p-4 border-b ${
              theme() === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 class={`text-lg font-semibold ${
                theme() === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Preview: {previewFile()?.name}
              </h3>
              <button
                onClick={() => setPreviewFile(null)}
                class={`p-1 rounded-md transition-colors ${
                  theme() === 'dark' 
                    ? 'text-gray-500 hover:text-gray-400 hover:bg-gray-700' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                <X class="w-5 h-5" />
              </button>
            </div>
            <div class="p-4 overflow-auto max-h-[calc(90vh-100px)]">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class={theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}>
                    <tr>
                      <For each={previewFile()?.headers}>
                        {(header) => (
                          <th class={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wider ${
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
                    <For each={previewFile()?.data.slice(0, 20)}>
                      {(row) => (
                        <tr>
                          <For each={row}>
                            {(cell) => (
                              <td class={`px-4 py-2 whitespace-nowrap text-sm ${
                                theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                              }`}>
                                {cell || 'NULL'}
                              </td>
                            )}
                          </For>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <Show when={previewFile() && previewFile()!.data.length > 20}>
                <p class={`text-sm mt-2 ${
                  theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Showing first 20 rows of {previewFile()!.data.length} total rows
                </p>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Normalization Statistics */}
      <Show when={normalizationStats() && showStats()}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <h2 class={`text-lg font-semibold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              <BarChart3 class="w-5 h-5 inline mr-2" />
              Normalization Statistics
            </h2>
            <button
              onClick={() => setShowStats(false)}
              class={`p-1 rounded-md transition-colors ${
                theme() === 'dark' 
                  ? 'text-gray-500 hover:text-gray-400 hover:bg-gray-700' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="Hide statistics"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div class={`p-4 rounded-lg ${
              theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <div class="flex items-center justify-between">
                <span class={`text-sm font-medium ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Original Rows
                </span>
                <span class={`text-2xl font-bold ${
                  theme() === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {normalizationStats()?.originalRows.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div class={`p-4 rounded-lg ${
              theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <div class="flex items-center justify-between">
                <span class={`text-sm font-medium ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Processed Rows
                </span>
                <span class={`text-2xl font-bold ${
                  theme() === 'dark' ? 'text-green-400' : 'text-green-600'
                }`}>
                  {normalizationStats()?.processedRows.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div class={`p-4 rounded-lg ${
              theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <div class="flex items-center justify-between">
                <span class={`text-sm font-medium ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Duplicates Removed
                </span>
                <span class={`text-2xl font-bold ${
                  theme() === 'dark' ? 'text-red-400' : 'text-red-600'
                }`}>
                  {normalizationStats()?.duplicatesRemoved.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div class={`p-4 rounded-lg ${
              theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <div class="flex items-center justify-between">
                <span class={`text-sm font-medium ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Empty Rows Removed
                </span>
                <span class={`text-2xl font-bold ${
                  theme() === 'dark' ? 'text-orange-400' : 'text-orange-600'
                }`}>
                  {normalizationStats()?.emptyRowsRemoved.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div class={`p-4 rounded-lg ${
              theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <div class="flex items-center justify-between">
                <span class={`text-sm font-medium ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Columns Standardized
                </span>
                <span class={`text-2xl font-bold ${
                  theme() === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  {normalizationStats()?.columnsStandardized.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div class={`p-4 rounded-lg ${
              theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <div class="flex items-center justify-between">
                <span class={`text-sm font-medium ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  Data Issues Fixed
                </span>
                <span class={`text-2xl font-bold ${
                  theme() === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`}>
                  {normalizationStats()?.dataIssuesFixed.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          
          <div class={`mt-6 p-4 rounded-lg ${
            theme() === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
          }`}>
            <h3 class={`text-sm font-medium mb-2 ${
              theme() === 'dark' ? 'text-blue-300' : 'text-blue-800'
            }`}>
              Processing Summary
            </h3>
            <div class="text-sm space-y-1">
              <div class={theme() === 'dark' ? 'text-blue-200' : 'text-blue-700'}>
                <strong>Data Reduction:</strong> {
                  normalizationStats()?.originalRows && normalizationStats()?.processedRows
                    ? ((normalizationStats()!.originalRows - normalizationStats()!.processedRows) / normalizationStats()!.originalRows * 100).toFixed(1)
                    : 0
                }% of rows removed
              </div>
              <div class={theme() === 'dark' ? 'text-blue-200' : 'text-blue-700'}>
                <strong>Quality Score:</strong> {
                  normalizationStats()?.originalRows 
                    ? Math.max(0, 100 - (normalizationStats()!.duplicatesRemoved + normalizationStats()!.emptyRowsRemoved) / normalizationStats()!.originalRows * 100).toFixed(1)
                    : 100
                }% (higher is better)
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Normalized Data Preview */}
      <Show when={normalizedData()}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <h2 class={`text-lg font-semibold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Normalized Data Preview</h2>
            <div class="flex items-center space-x-2">
              <div class="flex items-center space-x-2">
                <button
                  onClick={downloadNormalizedCSV}
                  class="btn btn-primary btn-sm"
                >
                  <Download class="w-4 h-4 mr-2" />
                  Download CSV
                </button>
                <button
                  onClick={() => {
                    const data = normalizedData();
                    const headers = normalizedHeaders();
                    if (!data || !headers) return;
                    
                    const jsonData = data.map(row => {
                      const obj: any = {};
                      headers.forEach((header, index) => {
                        obj[header] = row[index];
                      });
                      return obj;
                    });
                    
                    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'normalized_data.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    setSuccess('Normalized JSON downloaded!');
                  }}
                  class="btn btn-secondary btn-sm"
                >
                  <Download class="w-4 h-4 mr-2" />
                  Download JSON
                </button>
              </div>
            </div>
          </div>
          
          {/* Search and Filter */}
          <div class="mb-4">
            <div class="flex items-center space-x-2">
              <div class="flex-1 relative">
                <Search class={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                  theme() === 'dark' ? 'text-gray-500' : 'text-gray-400'
                }`} />
                <input
                  type="text"
                  placeholder="Search in data..."
                  value={searchTerm()}
                  onInput={(e) => setSearchTerm(e.target.value)}
                  class={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                    theme() === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
              <Show when={searchTerm()}>
                <button
                  onClick={() => setSearchTerm('')}
                  class={`p-2 rounded-lg transition-colors ${
                    theme() === 'dark' 
                      ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  title="Clear search"
                >
                  <X class="w-4 h-4" />
                </button>
              </Show>
            </div>
          </div>
          
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class={theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <For each={normalizedHeaders()}>
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
                <For each={filteredNormalizedData()?.slice(0, 10)}>
                  {(row) => (
                    <tr>
                      <For each={row}>
                        {(cell) => (
                          <td class={`px-6 py-4 whitespace-nowrap text-sm ${
                            theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                          }`}>
                            {highlightSearchTerm(String(cell || 'NULL'))}
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
          
          <div class="mt-4 flex items-center justify-between">
            <div class={`text-sm ${
              theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <Show when={searchTerm()}>
                Showing {Math.min(10, filteredNormalizedData()?.length || 0)} of {filteredNormalizedData()?.length} filtered rows
                <span class="mx-2">•</span>
              </Show>
              <Show when={!searchTerm()}>
                Showing first 10 rows of {normalizedData()!.length} total rows
              </Show>
              <Show when={searchTerm()}>
                Total: {normalizedData()!.length} rows
              </Show>
            </div>
            
            <Show when={searchTerm() && filteredNormalizedData()?.length === 0}>
              <div class={`text-sm ${
                theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                No results found for "{searchTerm()}"
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
              Normalizing data, please wait... {progress()}%
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default NormalizeCSV;

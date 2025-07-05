import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Upload, Download, Scissors, AlertCircle, CheckCircle, FileText, Loader } from 'lucide-solid';
import { useTheme } from '../contexts/ThemeContext';
import { splitSQL } from '../services/api';

interface SQLFile {
  name: string;
  size: number;
  content: string;
}

const SQLSplitter: Component = () => {
  const { theme } = useTheme();
  const [sqlFile, setSqlFile] = createSignal<{ name: string; content: string } | null>(null);
  const [splitFiles, setSplitFiles] = createSignal<SQLFile[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [loadingProgress, setLoadingProgress] = createSignal(0);
  const [showLoadingPopup, setShowLoadingPopup] = createSignal(false);
  
  const [splitMethod, setSplitMethod] = createSignal<'lines' | 'statements' | 'size'>('statements');
  const [linesPerFile, setLinesPerFile] = createSignal(1000);
  const [statementsPerFile, setStatementsPerFile] = createSignal(100);
  const [sizePerFile, setSizePerFile] = createSignal(1); // MB

  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    if (!file.name.toLowerCase().endsWith('.sql')) {
      setError('Please upload a SQL file (.sql extension)');
      setLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) {
          setError('Failed to read file content');
          setLoading(false);
          return;
        }

        setSqlFile({
          name: file.name,
          content: content
        });

        setLoading(false);
        setSuccess(`SQL file loaded successfully! Size: ${Math.round(file.size / 1024)}KB`);
      } catch (err) {
        setError(`Error reading file: ${err}`);
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Error reading file');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const splitSQLFile = async () => {
    const file = sqlFile();
    if (!file) {
      setError('No SQL file loaded');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setLoadingProgress(0);
    setShowLoadingPopup(true);

    // Simulate progress for demo purposes
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        const nextProgress = prev + 10;
        if (nextProgress >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return nextProgress;
      });
    }, 1000);

    try {
      // Determine the chunk size based on selected split method
      let maxChunkSize = 1000; // Default
      
      if (splitMethod() === 'lines') {
        maxChunkSize = linesPerFile();
      } else if (splitMethod() === 'statements') {
        maxChunkSize = statementsPerFile();
      } else if (splitMethod() === 'size') {
        // For 'size' method, we'll just use a rough approximation
        // 1MB is roughly 20,000 lines of SQL (very rough estimate)
        maxChunkSize = sizePerFile() * 20000;
      }
      
      // Call Python backend API
      const result = await splitSQL(file.content, maxChunkSize);
      
      if (result && result.chunks && result.chunks.length > 0) {
        const chunks = result.chunks;
        const fileName = file.name.replace('.sql', '');
        
        // Create split files
        const files: SQLFile[] = chunks.map((chunk, index) => {
          const name = `${fileName}_part${index + 1}.sql`;
          return {
            name,
            size: new Blob([chunk]).size,
            content: chunk
          };
        });
        
        setSplitFiles(files);
        setSuccess(`SQL file split into ${files.length} parts.`);
      } else {
        throw new Error('No chunks returned from server');
      }
    } catch (err: any) {
      setError(`Error splitting SQL file: ${err.message}`);
    } finally {
      setLoading(false);
      setShowLoadingPopup(false);
    }
  };

  const downloadFile = (file: SQLFile) => {
    const blob = new Blob([file.content], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    const files = splitFiles();
    if (files.length === 0) return;

    files.forEach(file => {
      setTimeout(() => downloadFile(file), 100);
    });
    
    setSuccess('All files downloaded!');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            theme() === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
          }`}>
            <Scissors class={`w-6 h-6 ${
              theme() === 'dark' ? 'text-red-400' : 'text-red-600'
            }`} />
          </div>
          <div>
            <h1 class={`text-2xl font-bold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              SQL Splitter
            </h1>
            <p class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
              Split large SQL files into smaller, manageable chunks
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <div class={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          theme() === 'dark' 
            ? 'border-gray-600 hover:border-red-500' 
            : 'border-gray-300 hover:border-red-400'
        }`}>
          <Upload class={`w-12 h-12 mx-auto mb-4 ${
            theme() === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`} />
          <div class="space-y-2">
            <label class="block">
              <span class="sr-only">Choose SQL file</span>
              <input
                type="file"
                accept=".sql"
                onChange={handleFileUpload}
                disabled={loading()}
                class={`block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold transition-colors disabled:opacity-50 ${
                  theme() === 'dark'
                    ? 'text-gray-300 file:bg-red-900/50 file:text-red-300 hover:file:bg-red-900/70'
                    : 'text-gray-500 file:bg-red-50 file:text-red-700 hover:file:bg-red-100'
                }`}
              />
            </label>
            <p class={`text-sm ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {loading() ? 'Loading SQL file...' : 'Upload a SQL file to split into smaller parts'}
            </p>
          </div>
        </div>
      </div>

      {/* Split Configuration */}
      <Show when={sqlFile()}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <h2 class={`text-lg font-semibold mb-4 ${
            theme() === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Split Configuration
          </h2>
          
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Split Method */}
              <div class="space-y-2">
                <label class={`block text-sm font-medium ${
                  theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>Split Method</label>
                <div class="space-y-2">
                  <label class="flex items-center">
                    <input
                      type="radio"
                      name="splitMethod"
                      value="statements"
                      checked={splitMethod() === 'statements'}
                      onChange={(e) => setSplitMethod(e.target.value as any)}
                      class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                    />
                    <span class={`ml-2 text-sm ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                    }`}>By SQL Statements</span>
                  </label>
                  <label class="flex items-center">
                    <input
                      type="radio"
                      name="splitMethod"
                      value="lines"
                      checked={splitMethod() === 'lines'}
                      onChange={(e) => setSplitMethod(e.target.value as any)}
                      class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                    />
                    <span class={`ml-2 text-sm ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                    }`}>By Lines</span>
                  </label>
                  <label class="flex items-center">
                    <input
                      type="radio"
                      name="splitMethod"
                      value="size"
                      checked={splitMethod() === 'size'}
                      onChange={(e) => setSplitMethod(e.target.value as any)}
                      class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                    />
                    <span class={`ml-2 text-sm ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-900'
                    }`}>By File Size</span>
                  </label>
                </div>
              </div>

              {/* Configuration Values */}
              <div class="space-y-4">
                <Show when={splitMethod() === 'statements'}>
                  <div>
                    <label class={`block text-sm font-medium mb-2 ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Statements per file
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={statementsPerFile()}
                      onInput={(e) => setStatementsPerFile(parseInt(e.target.value) || 100)}
                      class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                        theme() === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </Show>

                <Show when={splitMethod() === 'lines'}>
                  <div>
                    <label class={`block text-sm font-medium mb-2 ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Lines per file
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={linesPerFile()}
                      onInput={(e) => setLinesPerFile(parseInt(e.target.value) || 1000)}
                      class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                        theme() === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </Show>

                <Show when={splitMethod() === 'size'}>
                  <div>
                    <label class={`block text-sm font-medium mb-2 ${
                      theme() === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Max size per file (MB)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      max="1000"
                      step="0.1"
                      value={sizePerFile()}
                      onInput={(e) => setSizePerFile(parseFloat(e.target.value) || 1)}
                      class={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${
                        theme() === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </Show>
              </div>

              {/* File Info */}
              <div class={`rounded-lg p-4 ${
                theme() === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
                <h3 class={`font-medium mb-2 ${
                  theme() === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>File Information</h3>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Name:</span>
                    <span class={theme() === 'dark' ? 'text-gray-200' : 'text-gray-900'}>{sqlFile()?.name}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Size:</span>
                    <span class={theme() === 'dark' ? 'text-gray-200' : 'text-gray-900'}>{formatFileSize(new Blob([sqlFile()?.content || '']).size)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Lines:</span>
                    <span class="text-gray-900">{sqlFile()?.content.split('\n').length || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={splitSQLFile}
              disabled={loading()}
              class="btn btn-primary btn-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading() ? 'Splitting...' : 'Split SQL File'}
            </button>
          </div>
        </div>
      </Show>

      {/* Split Results */}
      <Show when={splitFiles().length > 0}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div class="flex items-center justify-between mb-4">
            <h2 class={`text-lg font-semibold ${
              theme() === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>Split Results</h2>
            <button
              onClick={downloadAll}
              class="btn btn-primary btn-sm"
            >
              <Download class="w-4 h-4 mr-2" />
              Download All ({splitFiles().length} files)
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <For each={splitFiles()}>
              {(file) => (
                <div class={`border rounded-lg p-4 transition-colors ${
                  theme() === 'dark' 
                    ? 'border-gray-600 hover:bg-gray-700' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center space-x-2 mb-2">
                        <FileText class={`w-4 h-4 ${
                          theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                        <span class={`text-sm font-medium ${
                          theme() === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{file.name}</span>
                      </div>
                      <p class={`text-sm mb-3 ${
                        theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Size: {formatFileSize(file.size)}
                      </p>
                      <button
                        onClick={() => downloadFile(file)}
                        class="btn btn-outline btn-sm w-full"
                      >
                        <Download class="w-4 h-4 mr-2" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* File Preview */}
      <Show when={sqlFile()}>
        <div class={`rounded-lg shadow-sm border p-6 ${
          theme() === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <h2 class={`text-lg font-semibold mb-4 ${
            theme() === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>File Preview</h2>
          <div class={`border rounded-lg p-4 ${
            theme() === 'dark' 
              ? 'bg-gray-900 border-gray-600' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <pre class={`text-sm overflow-auto max-h-64 ${
              theme() === 'dark' ? 'text-gray-300' : 'text-gray-800'
            }`}>
              <code>{sqlFile()?.content.substring(0, 2000)}</code>
            </pre>
            <Show when={sqlFile()?.content && sqlFile()!.content.length > 2000}>
              <p class={`text-sm mt-2 ${
                theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Showing first 2000 characters of {sqlFile()!.content.length} total characters
              </p>
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
      <Show when={showLoadingPopup()}>
        <div class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div class={`bg-white rounded-lg shadow-lg p-6 ${
            theme() === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div class="flex items-center justify-between mb-4">
              <h3 class={`text-lg font-semibold ${
                theme() === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Processing...</h3>
              <button
                onClick={() => setShowLoadingPopup(false)}
                class="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="flex items-center space-x-2 mb-4">
              <Loader class="w-6 h-6 text-red-500 animate-spin" />
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  class="bg-red-600 h-2.5 rounded-full"
                  style={{ width: `${loadingProgress()}%` }}
                />
              </div>
            </div>

            <p class={`text-center text-sm ${
              theme() === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {`Splitting SQL file... ${Math.round(loadingProgress())}%`}
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default SQLSplitter;

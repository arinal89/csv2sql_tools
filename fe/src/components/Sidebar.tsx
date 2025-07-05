import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Database, 
  FileText, 
  Settings, 
  Shield, 
  Scissors, 
  Github, 
  Menu, 
  X,
  Home,
  Sun,
  Moon
} from 'lucide-solid';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const Sidebar: Component<SidebarProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const menuItems = [
    { id: 'csv-to-sql', label: 'CSV to SQL', icon: Database, description: 'Convert CSV to SQL', path: '/csv-to-sql' },
    { id: 'normalize-csv', label: 'Normalize CSV', icon: FileText, description: 'Normalize CSV data', path: '/normalize-csv' },
    { id: 'data-type-csv', label: 'Data Type CSV', icon: Settings, description: 'Analyze data types', path: '/data-type-csv' },
    { id: 'null-handling', label: 'NULL Handling', icon: Shield, description: 'Handle NULL values', path: '/null-handling' },
    { id: 'sql-splitter', label: 'SQL Splitter', icon: Scissors, description: 'Split SQL files', path: '/sql-splitter' },
  ];

  const handleMenuClick = (item: typeof menuItems[0]) => {
    navigate(item.path);
    props.onViewChange(item.id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div class="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen())}
          class={`p-2 rounded-lg shadow-md border transition-colors ${
            theme() === 'dark' 
              ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' 
              : 'bg-white border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Show when={isOpen()} fallback={<Menu size={20} />}>
            <X size={20} />
          </Show>
        </button>
      </div>

      {/* Mobile overlay */}
      <Show when={isOpen()}>
        <div 
          class="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      </Show>

      {/* Sidebar */}
      <div class={`
        fixed lg:relative inset-y-0 left-0 z-50 w-64 shadow-xl border-r transition-transform duration-300 ease-in-out
        ${theme() === 'dark' 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
        }
        ${isOpen() ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div class="flex flex-col h-full">
          {/* Header */}
          <div class={`px-6 py-6 border-b ${theme() === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Home class="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 class={`text-xl font-bold ${theme() === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    CSV Tools
                  </h1>
                  <p class={`text-sm ${theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Data Processing Suite
                  </p>
                </div>
              </div>
              
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                class={`p-2 rounded-lg transition-colors ${
                  theme() === 'dark' 
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title={`Switch to ${theme() === 'dark' ? 'light' : 'dark'} mode`}
              >
                <Show when={theme() === 'dark'} fallback={<Moon class="w-5 h-5" />}>
                  <Sun class="w-5 h-5" />
                </Show>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav class="flex-1 px-4 py-6 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = props.currentView === item.id;
              
              return (
                <button
                  onClick={() => handleMenuClick(item)}
                  class={`
                    w-full flex items-center px-3 py-3 text-left rounded-lg transition-all duration-200
                    ${isActive 
                      ? `border-l-4 border-blue-500 shadow-sm ${
                          theme() === 'dark' 
                            ? 'bg-blue-900/50 text-blue-300' 
                            : 'bg-blue-50 text-blue-700'
                        }` 
                      : `${
                          theme() === 'dark' 
                            ? 'text-gray-300 hover:bg-gray-700 hover:text-gray-100' 
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`
                    }
                  `}
                >
                  <Icon class={`w-5 h-5 mr-3 ${
                    isActive 
                      ? (theme() === 'dark' ? 'text-blue-400' : 'text-blue-600')
                      : (theme() === 'dark' ? 'text-gray-400' : 'text-gray-400')
                  }`} />
                  <div class="flex-1">
                    <div class={`font-medium ${
                      isActive 
                        ? (theme() === 'dark' ? 'text-blue-300' : 'text-blue-900')
                        : (theme() === 'dark' ? 'text-gray-200' : 'text-gray-900')
                    }`}>
                      {item.label}
                    </div>
                    <div class={`text-xs mt-0.5 ${
                      theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div class={`px-4 py-4 border-t ${theme() === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <a
              href="https://github.com/arinal89/csv_tools"
              target="_blank"
              rel="noopener noreferrer"
              class={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                theme() === 'dark' 
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Github class="w-5 h-5 mr-3" />
              <span class="font-medium">GitHub</span>
            </a>
            <div class="px-3 py-2 text-xs">
              <div class="flex items-center justify-between">
                <span class={theme() === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                  Version 1.0.0
                </span>
                <span class="text-green-600">•</span>
              </div>
              <div class={`mt-1 ${theme() === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                Built with SolidJS & Tailwind
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

import { useLocation } from '@solidjs/router';
import type { Component, JSX } from 'solid-js';
import { useTheme } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: JSX.Element;
}

const Layout: Component<LayoutProps> = (props) => {
  const location = useLocation();
  const { theme } = useTheme();
  
  // Map URL paths to view IDs for the sidebar
  const getViewFromPath = (pathname: string): string => {
    switch (pathname) {
      case '/':
      case '/csv-to-sql':
        return 'csv-to-sql';
      case '/normalize-csv':
        return 'normalize-csv';
      case '/data-type-csv':
        return 'data-type-csv';
      case '/null-handling':
        return 'null-handling';
      case '/sql-splitter':
        return 'sql-splitter';
      default:
        return 'csv-to-sql';
    }
  };

  return (
    <div class={`flex h-screen ${theme() === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <Sidebar 
        currentView={getViewFromPath(location.pathname)} 
        onViewChange={() => {}} // Navigation is now handled by router
      />
      <main class="flex-1 overflow-auto">
        <div class="w-full p-6">
          {props.children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

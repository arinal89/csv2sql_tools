import { createContext, createSignal, useContext, onMount } from 'solid-js';
import type { Component, JSX } from 'solid-js';

interface ThemeContextType {
  theme: () => 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const ThemeContext = createContext<ThemeContextType>();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: JSX.Element;
}

export const ThemeProvider: Component<ThemeProviderProps> = (props) => {
  const [theme, setThemeSignal] = createSignal<'light' | 'dark'>('light');

  // Initialize theme from localStorage or system preference
  onMount(() => {
    const savedTheme = localStorage.getItem('csv-tools-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setThemeSignal(savedTheme);
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeSignal(systemPrefersDark ? 'dark' : 'light');
    }
  });

  // Apply theme to document
  const applyTheme = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('csv-tools-theme', newTheme);
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeSignal(newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme() === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Apply theme when it changes
  onMount(() => {
    applyTheme(theme());
  });

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
};

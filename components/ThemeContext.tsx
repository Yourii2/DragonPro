import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first, default to false if not set
    const saved = localStorage.getItem('Dragon_theme');
    if (saved) return saved === 'dark';
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Apply dark class to html, body and #root to ensure Tailwind dark: styles match
    try {
      const rootEl = document.getElementById('root');
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        if (rootEl) rootEl.classList.add('dark');
        // Fallback inline styles to ensure immediate visible change
        try {
          document.documentElement.style.backgroundColor = '#0f172a';
          document.body.style.backgroundColor = '#0f172a';
          document.body.style.color = '#f8fafc';
        } catch (e) {}
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        if (rootEl) rootEl.classList.remove('dark');
        // Remove fallback inline styles when leaving dark
        try {
          document.documentElement.style.backgroundColor = '';
          document.body.style.backgroundColor = '';
          document.body.style.color = '';
        } catch (e) {}
      }
    } catch (e) {
      // ignore if DOM isn't available
    }
    // Save preference
    localStorage.setItem('Dragon_theme', isDark ? 'dark' : 'light');
    // Dispatch a global event so any legacy code can react to theme change
    try {
      const ev = new CustomEvent('themeChange', { detail: { isDark } });
      window.dispatchEvent(ev);
    } catch (e) {
      // ignore
    }
    // Debug log for developers
    try {
      // eslint-disable-next-line no-console
      console.debug('[ThemeContext] themeChange dispatched, isDark=', isDark, 'html.hasDark=', document.documentElement.classList.contains('dark'), 'body.hasDark=', document.body.classList.contains('dark'));
    } catch (e) {
      // ignore
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};


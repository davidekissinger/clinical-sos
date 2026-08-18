import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'clinicalsos-theme';

function getStoredTheme() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch {}
  return 'system';
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getEffectiveTheme(theme) {
  return theme === 'system' ? getSystemTheme() : theme;
}

/**
 * Theme is scoped to the Command Center and Client Portal.
 * Public website always uses light branded presentation.
 * This prevents dark semantic text colors from applying to public pages
 * that use hard-coded light backgrounds.
 */
function isPrivateAppPath(pathname) {
  if (!pathname) return false;
  return pathname.startsWith('/command-center') || pathname.startsWith('/client');
}

function applyDarkClass(theme, pathname) {
  const shouldApplyDark = isPrivateAppPath(pathname) && getEffectiveTheme(theme) === 'dark';
  document.documentElement.classList.toggle('dark', shouldApplyDark);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);
  const location = useLocation();

  // Apply theme on mount, when theme changes, or when route changes
  useEffect(() => {
    applyDarkClass(theme, location.pathname);
  }, [theme, location.pathname]);

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyDarkClass('system', window.location.pathname);
    // Also listen for route changes (pushState)
    const popHandler = () => applyDarkClass('system', window.location.pathname);
    mq.addEventListener('change', handler);
    window.addEventListener('popstate', popHandler);
    return () => {
      mq.removeEventListener('change', handler);
      window.removeEventListener('popstate', popHandler);
    };
  }, [theme]);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    try { localStorage.setItem(STORAGE_KEY, newTheme); } catch {}
  }, []);

  const effectiveTheme = getEffectiveTheme(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
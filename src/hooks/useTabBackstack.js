import { useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function getBackStacks(storageKey) {
  try { return JSON.parse(sessionStorage.getItem(storageKey) || "{}"); }
  catch { return {}; }
}

function saveBackStack(storageKey, tabPath, pathname) {
  const stacks = getBackStacks(storageKey);
  stacks[tabPath] = pathname;
  sessionStorage.setItem(storageKey, JSON.stringify(stacks));
}

function clearBackStack(storageKey, tabPath) {
  const stacks = getBackStacks(storageKey);
  delete stacks[tabPath];
  sessionStorage.setItem(storageKey, JSON.stringify(stacks));
}

/**
 * Reusable tab backstack hook — preserves per-tab navigation history
 * and supports root-reset on double-tapping the active tab.
 *
 * @param {Array} navItems — items with { path, prefix, exact? }
 * @param {string} storageKey — sessionStorage key for backstack persistence
 * @returns {{ isActive, handleTabClick }}
 */
export function useTabBackstack(navItems, storageKey) {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabForPath = useCallback((pathname) => {
    for (const p of navItems) {
      if (p.exact) {
        if (pathname === p.prefix) return p.path;
      } else if (pathname.startsWith(p.prefix)) {
        return p.path;
      }
    }
    return null;
  }, [navItems]);

  const isActive = useCallback((item) => {
    if (item.exact) return location.pathname === item.prefix;
    return location.pathname.startsWith(item.prefix);
  }, [location.pathname]);

  useEffect(() => {
    const tabPath = getTabForPath(location.pathname);
    if (tabPath) saveBackStack(storageKey, tabPath, location.pathname);
  }, [location.pathname, getTabForPath, storageKey]);

  const handleTabClick = useCallback((path) => {
    const item = navItems.find(p => p.path === path);
    if (item && isActive(item)) {
      clearBackStack(storageKey, path);
      navigate(path);
    } else {
      const stacks = getBackStacks(storageKey);
      navigate(stacks[path] || path);
    }
  }, [navItems, isActive, storageKey, navigate]);

  return { isActive, handleTabClick };
}
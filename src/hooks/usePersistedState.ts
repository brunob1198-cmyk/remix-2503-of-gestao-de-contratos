import { useState, useEffect, useCallback } from "react";

/**
 * Like useState but persists to localStorage.
 * Supports string, string[], number, boolean.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  });

  // Update state when key changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setState(JSON.parse(stored) as T);
      } else {
        setState(defaultValue);
      }
    } catch {
      setState(defaultValue);
    }
  }, [key]);

  useEffect(() => {
    try {
      if (state === defaultValue || state === "" || (Array.isArray(state) && state.length === 0)) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(state));
      }
    } catch {
      // quota exceeded or similar
    }
  }, [key, state, defaultValue]);

  return [state, setState];
}

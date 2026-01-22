/**
 * useDebounce Hook
 * 
 * Debounces a value for the specified delay.
 * Useful for search inputs to avoid excessive API calls.
 * 
 * @module hooks/useDebounce
 */

import { useState, useEffect } from 'react';

/**
 * Debounce a value with a specified delay
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

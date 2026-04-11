import { useState, useDeferredValue, useMemo } from 'react';
import { searchIngredients } from '../data/ingredients';

/**
 * Hook for searching the curated ingredient list with exclusion support.
 * Uses useDeferredValue to avoid janky typing on rapid input changes.
 *
 * @param excludedItems - Items already selected (will be filtered out of results)
 * @returns query, setQuery, and filtered results array
 */
export function useIngredientSearch(excludedItems: string[] = []) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () => searchIngredients(deferredQuery, excludedItems),
    [deferredQuery, excludedItems]
  );

  return {
    query,
    setQuery,
    results,
  };
}

import { useState, useCallback } from 'react';

/**
 * Manages collection filter state for toggle pills.
 * Empty set = "All" (no filter applied).
 */
export function useCollectionFilter() {
  const [active, setActive] = useState<Set<string>>(new Set());

  const toggle = useCallback((collectionId: string) => {
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  }, []);

  const matches = useCallback((collectionId?: string) => {
    if (active.size === 0) return true; // "All" — no filter
    return collectionId ? active.has(collectionId) : true;
  }, [active]);

  return { active, toggle, matches };
}

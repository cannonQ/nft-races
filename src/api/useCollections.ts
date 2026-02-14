import { useState, useEffect, useCallback } from 'react';
import { Collection, ApiResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Fetch all collections.
 * GET ${API_BASE}/collections
 */
export function useCollections(): ApiResponse<Collection[]> {
  const [data, setData] = useState<Collection[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/collections`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const raw = await response.json();
      const collections: Collection[] = (raw ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
      }));
      setData(collections);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch collections'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

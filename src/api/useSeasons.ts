import { useState, useEffect, useCallback } from 'react';
import { Season, ApiResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Fetch all active seasons (one per collection).
 * GET ${API_BASE}/seasons/current
 * Returns array — handles both single-object and array responses from backend.
 */
export function useSeasons(): ApiResponse<Season[]> {
  const [data, setData] = useState<Season[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/seasons/current`);
      if (!response.ok) {
        // 404 = no active seasons — return empty array
        if (response.status === 404) {
          setData([]);
          return;
        }
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      // Backend returns object if single season, array if multiple
      const seasons: Season[] = Array.isArray(result) ? result : [result];
      setData(seasons);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch seasons'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

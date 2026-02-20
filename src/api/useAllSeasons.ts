import { useState, useEffect, useCallback } from 'react';
import { Season, ApiResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Fetch all seasons (active + completed).
 * GET ${API_BASE}/seasons
 */
export function useAllSeasons(): ApiResponse<Season[]> {
  const [data, setData] = useState<Season[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/seasons`);
      if (!response.ok) {
        if (response.status === 404) {
          setData([]);
          return;
        }
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const seasons: Season[] = await response.json();
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

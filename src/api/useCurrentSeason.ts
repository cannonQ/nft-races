import { useState, useEffect, useCallback } from 'react';
import { Season, ApiResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Fetch current active season
 * GET ${API_BASE}/seasons/current
 */
export function useCurrentSeason(): ApiResponse<Season> {
  const [data, setData] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/seasons/current`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const season = await response.json();
      setData(season);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch season'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

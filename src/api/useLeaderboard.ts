import { useState, useEffect, useCallback } from 'react';
import { LeaderboardEntry, ApiResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Fetch leaderboard, optionally filtered by season
 * GET ${API_BASE}/leaderboard?season=${seasonId}
 */
export function useLeaderboard(seasonId?: string): ApiResponse<LeaderboardEntry[]> {
  const [data, setData] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url = seasonId
        ? `${API_BASE}/leaderboard?season=${seasonId}`
        : `${API_BASE}/leaderboard`;
      const response = await fetch(url);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const entries = await response.json();
      setData(entries);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch leaderboard'));
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

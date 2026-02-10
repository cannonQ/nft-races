import { useState, useEffect, useCallback } from 'react';
import { ApiResponse } from '@/types/game';
import { API_BASE } from './config';

export interface RaceHistoryEntry {
  raceId: string;
  raceName: string;
  raceType: string;
  date: string;
  position: number;
  payout: number;
}

/**
 * Fetch race history for a creature
 * GET ${API_BASE}/creatures/${id}/race-history
 */
export function useRaceHistory(creatureId: string | null): ApiResponse<RaceHistoryEntry[]> {
  const [data, setData] = useState<RaceHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!creatureId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/creatures/${creatureId}/race-history`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const history = await response.json();
      setData(history);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch race history'));
    } finally {
      setLoading(false);
    }
  }, [creatureId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

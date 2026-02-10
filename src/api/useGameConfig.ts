import { useState, useEffect, useCallback } from 'react';
import { ApiResponse } from '@/types/game';
import { API_BASE } from './config';

export interface ActivityConfig {
  primary: string;
  primary_gain: number;
  secondary: string;
  secondary_gain: number;
  fatigue_cost: number;
}

export interface GameConfig {
  activities: Record<string, ActivityConfig>;
  raceTypeWeights: Record<string, Record<string, number>>;
  prizeDistribution: number[];
}

/**
 * Fetch public game configuration (activity definitions, race type weights).
 * GET ${API_BASE}/config
 */
export function useGameConfig(): ApiResponse<GameConfig> {
  const [data, setData] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/config`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const config = await response.json();
      setData(config);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch game config'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

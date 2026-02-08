import { useState, useEffect, useCallback } from 'react';
import { Season, ApiResponse } from '@/types/game';
import { API_BASE, delay } from './config';

// Mock season data
const mockSeason: Season = {
  id: 'season_001',
  name: 'Neon Genesis',
  seasonNumber: 1,
  modifier: {
    theme: 'Speed Surge',
    description: '+15% Speed stat effectiveness in all races',
  },
  startDate: '2026-01-15T00:00:00Z',
  endDate: '2026-03-15T00:00:00Z',
  prizePool: 125000,
  status: 'active',
};

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
      // TODO: Replace with real API call
      // const response = await fetch(`${API_BASE}/seasons/current`);
      // const data = await response.json();
      
      await delay();
      setData(mockSeason);
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

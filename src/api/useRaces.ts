import { useState, useEffect, useCallback } from 'react';
import { Race, RaceResults, EnterRaceResponse, ApiResponse, MutationResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Fetch all available races
 * GET ${API_BASE}/races
 */
export function useRaces(): ApiResponse<Race[]> {
  const [data, setData] = useState<Race[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/races`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const races = await response.json();
      setData(races);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch races'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Fetch results for a specific race
 * GET ${API_BASE}/races/${id}/results
 */
export function useRaceResults(raceId: string | null): ApiResponse<RaceResults> {
  const [data, setData] = useState<RaceResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!raceId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/races/${raceId}/results`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const results = await response.json();
      setData(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch race results'));
    } finally {
      setLoading(false);
    }
  }, [raceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Enter a creature into a race
 * POST ${API_BASE}/races/${id}/enter
 */
export function useEnterRace(): MutationResponse<EnterRaceResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    raceId: string,
    creatureId: string,
    walletAddress: string
  ): Promise<EnterRaceResponse> => {
    setLoading(true);
    setError(null);

    try {
      // No wallet signing needed — server verifies on-chain NFT ownership directly.
      // Signing will be reintroduced when race entry fee (ERG tx) is implemented.
      const response = await fetch(`${API_BASE}/races/${raceId}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatureId, walletAddress }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to enter race');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate: mutate as (...args: unknown[]) => Promise<EnterRaceResponse>, loading, error };
}

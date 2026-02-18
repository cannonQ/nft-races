import { useState, useEffect, useCallback } from 'react';
import { Race, RaceResults, EnterRaceResponse, EnterRaceBatchResponse, ApiResponse, MutationResponse } from '@/types/game';
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
 * Fetch creature IDs entered by a wallet in a specific race.
 * GET ${API_BASE}/races/${id}/entries?wallet=ADDRESS
 */
export function useRaceEntries(raceId: string | null | undefined, wallet: string | null | undefined): ApiResponse<string[]> {
  const [data, setData] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!raceId || !wallet) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/races/${raceId}/entries?wallet=${encodeURIComponent(wallet)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      setData(result.creatureIds ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch race entries'));
    } finally {
      setLoading(false);
    }
  }, [raceId, wallet]);

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
    walletAddress: string,
    txId?: string,
  ): Promise<EnterRaceResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/races/${raceId}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatureId, walletAddress, txId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      return await response.json().catch(() => {
        throw new Error('Server returned an invalid response. The entry may have succeeded — please refresh and check the race.');
      });
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

/**
 * Enter multiple creatures into a race in a single batch
 * POST ${API_BASE}/races/${id}/enter-batch
 */
export function useEnterRaceBatch(): MutationResponse<EnterRaceBatchResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    raceId: string,
    creatureIds: string[],
    walletAddress: string,
    txId?: string,
  ): Promise<EnterRaceBatchResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/races/${raceId}/enter-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatureIds, walletAddress, txId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      return await response.json().catch(() => {
        throw new Error('Server returned an invalid response. The entries may have succeeded — please refresh and check the race.');
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to enter race');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate: mutate as (...args: unknown[]) => Promise<EnterRaceBatchResponse>, loading, error };
}

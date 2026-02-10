import { useState, useEffect, useCallback } from 'react';
import { TrainingLogEntry, TrainResponse, Activity, ApiResponse, MutationResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Fetch training log for a creature
 * GET ${API_BASE}/creatures/${id}/training-log
 */
export function useTrainingLog(creatureId: string | null): ApiResponse<TrainingLogEntry[]> {
  const [data, setData] = useState<TrainingLogEntry[] | null>(null);
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
      const response = await fetch(`${API_BASE}/creatures/${creatureId}/training-log`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const log = await response.json();
      setData(log);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch training log'));
    } finally {
      setLoading(false);
    }
  }, [creatureId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Execute a training action
 * POST ${API_BASE}/train
 */
export function useTrain(): MutationResponse<TrainResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    creatureId: string,
    activity: Activity,
    walletAddress: string,
    boostRewardIds?: string[],
  ): Promise<TrainResponse> => {
    setLoading(true);
    setError(null);

    try {
      // No wallet signing needed — server verifies on-chain NFT ownership directly.
      // Signing will be reintroduced when training fee (0.01 ERG tx) is implemented.
      const response = await fetch(`${API_BASE}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatureId, activity, walletAddress, boostRewardIds }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Training failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate: mutate as (...args: unknown[]) => Promise<TrainResponse>, loading, error };
}

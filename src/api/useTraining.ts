import { useState, useEffect, useCallback } from 'react';
import { TrainingLogEntry, TrainResponse, BatchTrainResponse, BatchTrainCreatureInput, Activity, ApiResponse, MutationResponse } from '@/types/game';
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
    txId?: string,
    paymentCurrency?: string,
  ): Promise<TrainResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatureId, activity, walletAddress, boostRewardIds, txId, paymentCurrency }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      return await response.json().catch(() => {
        throw new Error('Server returned an invalid response. The training may have succeeded — please refresh and check your creature.');
      });
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

/**
 * Execute batch training for multiple creatures
 * POST ${API_BASE}/train-batch
 */
export function useTrainBatch(): MutationResponse<BatchTrainResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    creatures: BatchTrainCreatureInput[],
    walletAddress: string,
    txId?: string,
    paymentCurrency?: string,
  ): Promise<BatchTrainResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/train-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatures, walletAddress, txId, paymentCurrency }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      return await response.json().catch(() => {
        throw new Error('Server returned an invalid response. The training may have succeeded — please refresh and check your creatures.');
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Batch training failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate: mutate as (...args: unknown[]) => Promise<BatchTrainResponse>, loading, error };
}

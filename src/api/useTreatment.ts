import { useState, useCallback } from 'react';
import { TreatmentStartResponse, MutationResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Execute a treatment action
 * POST ${API_BASE}/treatment/start
 */
export function useTreatment(): MutationResponse<TreatmentStartResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    creatureId: string,
    treatmentType: string,
    walletAddress: string,
    txId?: string,
  ): Promise<TreatmentStartResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/treatment/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatureId, treatmentType, walletAddress, txId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Treatment failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate: mutate as (...args: unknown[]) => Promise<TreatmentStartResponse>, loading, error };
}

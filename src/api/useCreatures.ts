import { useState, useEffect, useCallback } from 'react';
import { CreatureWithStats, ApiResponse, RegisterCreatureResponse, MutationResponse } from '@/types/game';
import { API_BASE } from './config';
import { createAuthHeaders } from '@/lib/ergo/auth';

/**
 * Fetch all creatures owned by a wallet
 * GET ${API_BASE}/creatures/by-wallet/${address}
 */
export function useCreaturesByWallet(walletAddress: string | null): ApiResponse<CreatureWithStats[]> {
  const [data, setData] = useState<CreatureWithStats[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!walletAddress) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/creatures/by-wallet/${walletAddress}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const creatures = await response.json();
      setData(creatures);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch creatures'));
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Fetch a single creature by ID
 * GET ${API_BASE}/creatures/${id}
 */
export function useCreature(creatureId: string | null): ApiResponse<CreatureWithStats> {
  const [data, setData] = useState<CreatureWithStats | null>(null);
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
      const response = await fetch(`${API_BASE}/creatures/${creatureId}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const creature = await response.json();
      setData(creature);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch creature'));
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
 * Register a new creature from NFT
 * POST ${API_BASE}/creatures/register
 */
export function useRegisterCreature(): MutationResponse<RegisterCreatureResponse> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (tokenId: string, walletAddress: string): Promise<RegisterCreatureResponse> => {
    setLoading(true);
    setError(null);

    try {
      // Auth headers require Nautilus signing — skip for ErgoPay (server verifies via Explorer API)
      let authHeaders: Record<string, string> = {};
      try {
        authHeaders = await createAuthHeaders(walletAddress, 'register');
      } catch {
        // ErgoPay or signing unavailable — proceed without auth headers
      }
      const response = await fetch(`${API_BASE}/creatures/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ tokenId, walletAddress }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to register creature');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate: mutate as (...args: unknown[]) => Promise<RegisterCreatureResponse>, loading, error };
}

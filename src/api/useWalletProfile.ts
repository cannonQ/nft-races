import { useState, useEffect, useCallback } from 'react';
import { WalletProfile, ApiResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Fetch wallet display name.
 * GET ${API_BASE}/wallet/${address}/profile
 */
export function useWalletProfile(
  address: string | null,
): ApiResponse<WalletProfile> {
  const [data, setData] = useState<WalletProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!address) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/wallet/${address}/profile`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Update wallet display name.
 * PUT ${API_BASE}/wallet/${address}/profile
 */
export function useUpdateWalletProfile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (address: string, displayName: string | null): Promise<WalletProfile> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/wallet/${address}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, displayName }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      return body;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to update profile');
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}

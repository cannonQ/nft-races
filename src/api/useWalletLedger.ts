import { useState, useEffect, useCallback } from 'react';
import { WalletLedger, ApiResponse } from '@/types/game';
import { API_BASE } from './config';

/**
 * Fetch wallet credit ledger (shadow billing history).
 * GET ${API_BASE}/wallet/${address}/ledger?limit=50&offset=0
 */
export function useWalletLedger(
  address: string | null,
  limit = 50,
  offset = 0,
): ApiResponse<WalletLedger> {
  const [data, setData] = useState<WalletLedger | null>(null);
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
      const url = `${API_BASE}/wallet/${address}/ledger?limit=${limit}&offset=${offset}`;
      const response = await fetch(url);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch ledger'));
    } finally {
      setLoading(false);
    }
  }, [address, limit, offset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

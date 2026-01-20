/**
 * useErgoWallet Hook
 * React hook for managing Ergo wallet connection state
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { WalletState, TokenBalance } from '@/lib/ergo/types';
import {
  isNautilusInstalled,
  connectNautilus,
  disconnectNautilus,
  isWalletConnected,
  getWalletAddress,
  getAllAddresses,
  getBalance,
  signRaceEntry,
  submitRaceEntry,
} from '@/lib/ergo/client';

// ============================================
// Hook Return Type
// ============================================

interface UseErgoWalletReturn {
  // State
  state: WalletState;
  isInstalled: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;

  // Race Entry
  signAndJoinRace: (raceId: string, nftTokenId: string) => Promise<{
    success: boolean;
    entryId?: string;
    error?: string;
  }>;
}

// ============================================
// Hook Implementation
// ============================================

export function useErgoWallet(): UseErgoWalletReturn {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    addresses: [],
    balance: null,
    loading: false,
    error: null,
  });

  const [isInstalled, setIsInstalled] = useState(false);

  // Check if Nautilus is installed on mount
  useEffect(() => {
    // Only run on client
    if (typeof window !== 'undefined') {
      // Small delay to ensure extension is loaded
      const timer = setTimeout(() => {
        setIsInstalled(isNautilusInstalled());
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Check existing connection on mount
  useEffect(() => {
    if (!isInstalled) return;

    const checkConnection = async () => {
      try {
        const connected = await isWalletConnected();
        if (connected) {
          const address = await getWalletAddress();
          const addresses = await getAllAddresses();
          const balance = await getBalance();

          setState(prev => ({
            ...prev,
            connected: true,
            address,
            addresses,
            balance: {
              address,
              nanoErgs: balance,
              tokens: [],
            },
          }));
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    };

    checkConnection();
  }, [isInstalled]);

  // Connect wallet
  const connect = useCallback(async () => {
    if (!isInstalled) {
      setState(prev => ({
        ...prev,
        error: 'Nautilus wallet is not installed',
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      await connectNautilus();

      const address = await getWalletAddress();
      const addresses = await getAllAddresses();
      const balance = await getBalance();

      setState({
        connected: true,
        address,
        addresses,
        balance: {
          address,
          nanoErgs: balance,
          tokens: [],
        },
        loading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }));
    }
  }, [isInstalled]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      await disconnectNautilus();
      setState({
        connected: false,
        address: null,
        addresses: [],
        balance: null,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to disconnect',
      }));
    }
  }, []);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!state.connected || !state.address) return;

    try {
      const balance = await getBalance();
      setState(prev => ({
        ...prev,
        balance: prev.balance
          ? { ...prev.balance, nanoErgs: balance }
          : { address: state.address!, nanoErgs: balance, tokens: [] },
      }));
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  }, [state.connected, state.address]);

  // Sign and join race
  const signAndJoinRace = useCallback(
    async (raceId: string, nftTokenId: string) => {
      if (!state.connected || !state.address) {
        return {
          success: false,
          error: 'Wallet not connected',
        };
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        const result = await submitRaceEntry(raceId, nftTokenId);

        setState(prev => ({ ...prev, loading: false }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to join race';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [state.connected, state.address]
  );

  return {
    state,
    isInstalled,
    connect,
    disconnect,
    refreshBalance,
    signAndJoinRace,
  };
}

// ============================================
// Utility: Format ERG balance for display
// ============================================

export function formatErg(nanoErgs: bigint): string {
  const erg = Number(nanoErgs) / 1_000_000_000;
  return erg.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 9,
  });
}

// ============================================
// Utility: Truncate address for display
// ============================================

export function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

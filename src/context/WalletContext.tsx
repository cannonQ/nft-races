import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  isNautilusInstalled,
  connectNautilus,
  disconnectNautilus,
  isWalletConnected,
  getWalletAddress,
  getBalance,
  signMessage as ergoSignMessage,
} from '@/lib/ergo/client';
import { buildAndSubmitEntryFeeTx } from '@/lib/ergo/transactions';
import type { SignedMessage } from '@/lib/ergo/types';

// ============================================
// Context Interface (superset of previous — backward compatible)
// ============================================

interface WalletContextType {
  // Existing fields (all 8 consumers use these)
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;

  // New fields
  isInstalled: boolean;
  loading: boolean;
  error: string | null;
  balance: string | null; // nanoERG as string
  signMessage: (message: string) => Promise<SignedMessage>;
  buildAndSubmitEntryFee: (
    feeNanoErgs: number,
    treasuryErgoTree: string
  ) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const STORAGE_KEY = 'nautilus-connected';

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if Nautilus is installed (with delay for extension injection)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInstalled(isNautilusInstalled());
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Auto-reconnect if previously connected
  useEffect(() => {
    if (!isInstalled) return;

    const wasConnected = localStorage.getItem(STORAGE_KEY) === 'true';
    if (!wasConnected) return;

    const autoReconnect = async () => {
      try {
        const stillConnected = await isWalletConnected();
        if (stillConnected && window.ergo) {
          const addr = await getWalletAddress();
          const bal = await getBalance();
          setAddress(addr);
          setBalance(bal);
          setConnected(true);
        } else {
          // Try to reconnect silently
          await connectNautilus();
          const addr = await getWalletAddress();
          const bal = await getBalance();
          setAddress(addr);
          setBalance(bal);
          setConnected(true);
        }
      } catch {
        // Auto-reconnect failed silently — user will need to click connect
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    autoReconnect();
  }, [isInstalled]);

  // Listen for wallet disconnect event (from frontend-field-main pattern)
  useEffect(() => {
    const handleDisconnect = () => {
      setAddress(null);
      setBalance(null);
      setConnected(false);
      localStorage.removeItem(STORAGE_KEY);
    };

    window.addEventListener('ergo_wallet_disconnected', handleDisconnect);
    return () => {
      window.removeEventListener('ergo_wallet_disconnected', handleDisconnect);
    };
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await connectNautilus();
      const addr = await getWalletAddress();
      const bal = await getBalance();

      setAddress(addr);
      setBalance(bal);
      setConnected(true);
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await disconnectNautilus();
    } catch {
      // Ignore disconnect errors
    }
    setAddress(null);
    setBalance(null);
    setConnected(false);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const signMessage = useCallback(
    async (message: string): Promise<SignedMessage> => {
      if (!address) throw new Error('Wallet not connected');
      return await ergoSignMessage(address, message);
    },
    [address]
  );

  const buildAndSubmitEntryFee = useCallback(
    async (feeNanoErgs: number, treasuryErgoTree: string): Promise<string> => {
      if (!connected) throw new Error('Wallet not connected');
      return await buildAndSubmitEntryFeeTx(feeNanoErgs, treasuryErgoTree);
    },
    [connected]
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        connected,
        connect,
        disconnect,
        isInstalled,
        loading,
        error,
        balance,
        signMessage,
        buildAndSubmitEntryFee,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

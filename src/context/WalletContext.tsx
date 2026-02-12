import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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
import {
  initErgoPaySession,
  pollErgoPayStatus,
  type ErgoPaySession,
} from '@/lib/ergo/ergopay';
import type { SignedMessage } from '@/lib/ergo/types';

// ============================================
// Types
// ============================================

export type WalletType = 'nautilus' | 'ergopay' | null;

export interface ErgoPaySessionState {
  sessionId: string;
  ergoPayUrl: string;
  expiresAt: string;
  status: 'pending' | 'connected' | 'expired';
}

interface WalletContextType {
  // Core fields (backward-compatible with all consumers)
  address: string | null;
  connected: boolean;
  connect: () => void; // Opens wallet selection dialog
  disconnect: () => Promise<void>;

  // Capability fields
  isInstalled: boolean; // Nautilus detected
  loading: boolean;
  error: string | null;
  balance: string | null;
  walletType: WalletType;
  canSign: boolean;    // true for Nautilus, false for ErgoPay
  canSubmitTx: boolean; // true for Nautilus, false for ErgoPay

  // Nautilus-only capabilities (throw for ErgoPay)
  signMessage: (message: string) => Promise<SignedMessage>;
  buildAndSubmitEntryFee: (
    feeNanoErgs: number,
    treasuryErgoTree: string
  ) => Promise<string>;

  // Wallet selection dialog
  showWalletSelect: boolean;
  setShowWalletSelect: (show: boolean) => void;

  // Direct connect methods (called from wallet selection dialog)
  connectNautilusWallet: () => Promise<void>;
  connectErgoPayWallet: () => Promise<void>;
  cancelErgoPay: () => void;

  // ErgoPay session (for QR code / polling UI)
  ergoPaySession: ErgoPaySessionState | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// ============================================
// Persistence
// ============================================

const WALLET_STORAGE_KEY = 'cyberpets-wallet';

interface StoredWallet {
  type: 'nautilus' | 'ergopay';
  address?: string; // Only for ErgoPay
}

function loadStoredWallet(): StoredWallet | null {
  try {
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) {
      // Migrate from old key
      if (localStorage.getItem('nautilus-connected') === 'true') {
        return { type: 'nautilus' };
      }
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveWallet(wallet: StoredWallet): void {
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
  // Clean up old key if present
  localStorage.removeItem('nautilus-connected');
}

function clearWallet(): void {
  localStorage.removeItem(WALLET_STORAGE_KEY);
  localStorage.removeItem('nautilus-connected');
}

// ============================================
// Provider
// ============================================

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
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const [ergoPaySession, setErgoPaySession] = useState<ErgoPaySessionState | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if Nautilus is installed (with delay for extension injection)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInstalled(isNautilusInstalled());
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Auto-reconnect from stored wallet
  useEffect(() => {
    const stored = loadStoredWallet();
    if (!stored) return;

    if (stored.type === 'nautilus') {
      // Wait for Nautilus detection before auto-reconnecting
      const timer = setTimeout(async () => {
        if (!isNautilusInstalled()) {
          clearWallet();
          return;
        }
        try {
          const stillConnected = await isWalletConnected();
          if (stillConnected && window.ergo) {
            const addr = await getWalletAddress();
            const bal = await getBalance();
            setAddress(addr);
            setBalance(bal);
            setConnected(true);
            setWalletType('nautilus');
          } else {
            await connectNautilus();
            const addr = await getWalletAddress();
            const bal = await getBalance();
            setAddress(addr);
            setBalance(bal);
            setConnected(true);
            setWalletType('nautilus');
          }
        } catch {
          clearWallet();
        }
      }, 150);
      return () => clearTimeout(timer);
    }

    if (stored.type === 'ergopay' && stored.address) {
      // ErgoPay: trust the stored address (server verifies ownership on mutations)
      setAddress(stored.address);
      setConnected(true);
      setWalletType('ergopay');
      setBalance(null); // Can't query balance without Nautilus
    }
  }, []);

  // Listen for Nautilus disconnect event
  useEffect(() => {
    const handleDisconnect = () => {
      if (walletType !== 'nautilus') return;
      setAddress(null);
      setBalance(null);
      setConnected(false);
      setWalletType(null);
      clearWallet();
    };

    window.addEventListener('ergo_wallet_disconnected', handleDisconnect);
    return () => {
      window.removeEventListener('ergo_wallet_disconnected', handleDisconnect);
    };
  }, [walletType]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ---- Connect methods ----

  const connect = useCallback(() => {
    setShowWalletSelect(true);
  }, []);

  const connectNautilusWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    setShowWalletSelect(false);

    try {
      await connectNautilus();
      const addr = await getWalletAddress();
      const bal = await getBalance();

      setAddress(addr);
      setBalance(bal);
      setConnected(true);
      setWalletType('nautilus');
      saveWallet({ type: 'nautilus' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const connectErgoPayWallet = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await initErgoPaySession();
      setErgoPaySession({
        sessionId: session.sessionId,
        ergoPayUrl: session.ergoPayUrl,
        expiresAt: session.expiresAt,
        status: 'pending',
      });
      setLoading(false);

      // Start polling for wallet response
      if (pollingRef.current) clearInterval(pollingRef.current);

      pollingRef.current = setInterval(async () => {
        try {
          const result = await pollErgoPayStatus(session.sessionId);

          if (result.status === 'connected') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;

            setAddress(result.address);
            setBalance(null); // Can't query balance via ErgoPay
            setConnected(true);
            setWalletType('ergopay');
            setShowWalletSelect(false);
            setErgoPaySession(null);
            saveWallet({ type: 'ergopay', address: result.address });
          } else if (result.status === 'expired' || result.status === 'not_found') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;

            setErgoPaySession((prev) =>
              prev ? { ...prev, status: 'expired' } : null
            );
          }
        } catch {
          // Polling error — keep trying until expiry
        }
      }, 2000);
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Failed to start ErgoPay session';
      setError(msg);
    }
  }, []);

  const cancelErgoPay = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setErgoPaySession(null);
    setLoading(false);
    setError(null);
  }, []);

  // ---- Disconnect ----

  const disconnect = useCallback(async () => {
    if (walletType === 'nautilus') {
      try {
        await disconnectNautilus();
      } catch {
        // Ignore disconnect errors
      }
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setAddress(null);
    setBalance(null);
    setConnected(false);
    setWalletType(null);
    setError(null);
    setErgoPaySession(null);
    clearWallet();
  }, [walletType]);

  // ---- Nautilus-only capabilities ----

  const signMessage = useCallback(
    async (message: string): Promise<SignedMessage> => {
      if (!address) throw new Error('Wallet not connected');
      if (walletType !== 'nautilus') {
        throw new Error('Message signing is not available with ErgoPay wallet');
      }
      return await ergoSignMessage(address, message);
    },
    [address, walletType]
  );

  const buildAndSubmitEntryFee = useCallback(
    async (feeNanoErgs: number, treasuryErgoTree: string): Promise<string> => {
      if (!connected) throw new Error('Wallet not connected');
      if (walletType !== 'nautilus') {
        throw new Error('Transaction signing is not available with ErgoPay wallet');
      }
      return await buildAndSubmitEntryFeeTx(feeNanoErgs, treasuryErgoTree);
    },
    [connected, walletType]
  );

  const canSign = walletType === 'nautilus';
  const canSubmitTx = walletType === 'nautilus';

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
        walletType,
        canSign,
        canSubmitTx,
        signMessage,
        buildAndSubmitEntryFee,
        showWalletSelect,
        setShowWalletSelect,
        connectNautilusWallet,
        connectErgoPayWallet,
        cancelErgoPay,
        ergoPaySession,
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

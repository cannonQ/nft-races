import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface WalletContextType {
  address: string | null;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Mock wallet address - will be replaced with real Nautilus wallet integration
const MOCK_WALLET_ADDRESS = '0x7a3B...4f2E';

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(() => {
    // TODO: Replace with real Nautilus wallet connection
    setAddress(MOCK_WALLET_ADDRESS);
    setConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setConnected(false);
  }, []);

  return (
    <WalletContext.Provider value={{ address, connected, connect, disconnect }}>
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

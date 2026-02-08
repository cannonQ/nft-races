import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/WalletContext';

export function WalletConnect() {
  const { address, connected, connect, disconnect } = useWallet();

  const handleClick = () => {
    if (connected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      className={`
        font-mono text-sm border-primary/50 hover:border-primary
        transition-all duration-300
        ${connected 
          ? 'bg-primary/10 text-primary glow-cyan' 
          : 'hover:bg-primary/10 hover:text-primary'
        }
      `}
    >
      <Wallet className="w-4 h-4 mr-2" />
      {connected ? address : 'Connect Wallet'}
    </Button>
  );
}

import { Wallet, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/WalletContext';
import { truncateAddress } from '@/lib/ergo/client';

const NAUTILUS_INSTALL_URL =
  'https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai';

export function WalletConnect() {
  const { address, connected, connect, disconnect, isInstalled, loading, error } =
    useWallet();

  // State: Nautilus not installed
  if (!isInstalled) {
    return (
      <Button
        variant="outline"
        className="font-mono text-sm border-primary/50 hover:border-primary hover:bg-primary/10 hover:text-primary transition-all duration-300"
        onClick={() => window.open(NAUTILUS_INSTALL_URL, '_blank')}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Install Nautilus
      </Button>
    );
  }

  // State: Loading / Connecting
  if (loading) {
    return (
      <Button
        variant="outline"
        disabled
        className="font-mono text-sm border-primary/50"
      >
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Connecting...
      </Button>
    );
  }

  // State: Error
  if (error && !connected) {
    return (
      <Button
        variant="outline"
        className="font-mono text-sm border-destructive/50 text-destructive hover:border-destructive hover:bg-destructive/10 transition-all duration-300"
        onClick={() => connect()}
      >
        <AlertCircle className="w-4 h-4 mr-2" />
        Retry Connect
      </Button>
    );
  }

  // State: Connected
  if (connected && address) {
    return (
      <Button
        onClick={() => disconnect()}
        variant="outline"
        className="font-mono text-sm border-primary/50 hover:border-primary bg-primary/10 text-primary glow-cyan transition-all duration-300"
        title={`${address}\nClick to disconnect`}
      >
        <Wallet className="w-4 h-4 mr-2" />
        {truncateAddress(address)}
      </Button>
    );
  }

  // State: Not connected
  return (
    <Button
      onClick={() => connect()}
      variant="outline"
      className="font-mono text-sm border-primary/50 hover:border-primary hover:bg-primary/10 hover:text-primary transition-all duration-300"
    >
      <Wallet className="w-4 h-4 mr-2" />
      Connect Wallet
    </Button>
  );
}

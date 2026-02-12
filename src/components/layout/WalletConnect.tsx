import { Wallet, Loader2, AlertCircle, Smartphone, Monitor, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useWallet } from '@/context/WalletContext';
import { truncateAddress } from '@/lib/ergo/client';
import { isMobileDevice } from '@/lib/ergo/ergopay';

const NAUTILUS_INSTALL_URL =
  'https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai';

export function WalletConnect() {
  const {
    address,
    connected,
    connect,
    disconnect,
    isInstalled,
    loading,
    error,
    walletType,
    showWalletSelect,
    setShowWalletSelect,
    connectNautilusWallet,
    connectErgoPayWallet,
    cancelErgoPay,
    ergoPaySession,
  } = useWallet();

  const isMobile = isMobileDevice();

  // State: Loading / Connecting
  if (loading && !ergoPaySession) {
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
  if (error && !connected && !showWalletSelect) {
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
        title={`${address}\n${walletType === 'ergopay' ? 'ErgoPay' : 'Nautilus'} — Click to disconnect`}
      >
        {walletType === 'ergopay' ? (
          <Smartphone className="w-4 h-4 mr-2" />
        ) : (
          <Wallet className="w-4 h-4 mr-2" />
        )}
        {truncateAddress(address)}
      </Button>
    );
  }

  // State: Not connected — button + dialog
  return (
    <>
      <Button
        onClick={() => connect()}
        variant="outline"
        className="font-mono text-sm border-primary/50 hover:border-primary hover:bg-primary/10 hover:text-primary transition-all duration-300"
      >
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>

      <Dialog
        open={showWalletSelect}
        onOpenChange={(open) => {
          if (!open) {
            cancelErgoPay();
            setShowWalletSelect(false);
          }
        }}
      >
        <DialogContent className="border-primary/30 bg-background">
          {ergoPaySession ? (
            // Phase B: ErgoPay QR code / deep link
            <ErgoPayConnecting
              session={ergoPaySession}
              isMobile={isMobile}
              onCancel={() => cancelErgoPay()}
            />
          ) : (
            // Phase A: Wallet selection
            <WalletSelection
              isNautilusInstalled={isInstalled}
              isMobile={isMobile}
              onSelectNautilus={connectNautilusWallet}
              onSelectErgoPay={connectErgoPayWallet}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================
// Wallet Selection (Phase A)
// ============================================

function WalletSelection({
  isNautilusInstalled,
  isMobile,
  onSelectNautilus,
  onSelectErgoPay,
}: {
  isNautilusInstalled: boolean;
  isMobile: boolean;
  onSelectNautilus: () => void;
  onSelectErgoPay: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">Connect Your Wallet</DialogTitle>
        <DialogDescription className="text-center">
          Choose how to connect your Ergo wallet
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 mt-2">
        {/* Nautilus option */}
        {!isMobile && (
          <button
            onClick={isNautilusInstalled ? onSelectNautilus : () => window.open(NAUTILUS_INSTALL_URL, '_blank')}
            className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-left"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Nautilus</div>
              <div className="text-xs text-muted-foreground">
                {isNautilusInstalled ? 'Desktop browser extension' : 'Install browser extension'}
              </div>
            </div>
          </button>
        )}

        {/* ErgoPay option */}
        <button
          onClick={onSelectErgoPay}
          className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-left"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">ErgoPay</div>
            <div className="text-xs text-muted-foreground">
              {isMobile ? 'Connect with Terminus or compatible wallet' : 'Scan QR code with mobile wallet'}
            </div>
          </div>
        </button>
      </div>
    </>
  );
}

// ============================================
// ErgoPay Connecting (Phase B)
// ============================================

function ErgoPayConnecting({
  session,
  isMobile,
  onCancel,
}: {
  session: { ergoPayUrl: string; status: string };
  isMobile: boolean;
  onCancel: () => void;
}) {
  if (session.status === 'expired') {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-center">Session Expired</DialogTitle>
          <DialogDescription className="text-center">
            The connection session has expired. Please try again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <Button variant="outline" onClick={onCancel}>
            Try Again
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">
          {isMobile ? 'Open in Your Wallet' : 'Scan with Your Wallet'}
        </DialogTitle>
        <DialogDescription className="text-center">
          {isMobile
            ? 'Tap the button below to connect with your Ergo wallet'
            : 'Scan this QR code with Terminus or another ErgoPay-compatible wallet'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center gap-4">
        {/* QR Code (always show, more useful on desktop) */}
        {!isMobile && (
          <div className="bg-white rounded-xl p-4">
            <QRCodeSVG
              value={session.ergoPayUrl}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
        )}

        {/* Deep link button (mobile) */}
        {isMobile && (
          <a
            href={session.ergoPayUrl}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            Open in Wallet
          </a>
        )}

        {/* Waiting indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Waiting for wallet connection...
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-muted-foreground"
        >
          <X className="w-3 h-3 mr-1" />
          Cancel
        </Button>
      </div>
    </>
  );
}

import { useState } from 'react';
import { Wallet, Loader2, AlertCircle, Smartphone, Monitor, X, User, LogOut } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWallet } from '@/context/WalletContext';
import { useWalletProfile, useUpdateWalletProfile } from '@/api';
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
  const { data: profile, refetch: refetchProfile } = useWalletProfile(address);
  const { mutate: updateProfile, loading: savingName, error: saveError } = useUpdateWalletProfile();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const displayName = profile?.displayName ?? null;

  const handleSaveName = async () => {
    if (!address) return;
    setNameError(null);
    try {
      await updateProfile(address, nameInput.trim() || null);
      refetchProfile();
      setShowNameDialog(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const openNameDialog = () => {
    setNameInput(displayName ?? '');
    setNameError(null);
    setShowNameDialog(true);
  };

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
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="text-sm border-primary/50 hover:border-primary bg-primary/10 text-primary glow-cyan transition-all duration-300 max-w-[200px]"
              title={`${address}\n${walletType === 'ergopay' ? 'ErgoPay' : 'Nautilus'}`}
            >
              {walletType === 'ergopay' ? (
                <Smartphone className="w-4 h-4 mr-2 flex-shrink-0" />
              ) : (
                <Wallet className="w-4 h-4 mr-2 flex-shrink-0" />
              )}
              <span className="truncate">
                {displayName || truncateAddress(address)}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {displayName && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-mono">
                {truncateAddress(address)}
              </div>
            )}
            <DropdownMenuItem onClick={openNameDialog}>
              <User className="w-4 h-4 mr-2" />
              {displayName ? 'Edit Display Name' : 'Set Display Name'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => disconnect()}>
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Display Name Dialog */}
        <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
          <DialogContent className="border-primary/30 bg-background sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{displayName ? 'Edit Display Name' : 'Set Display Name'}</DialogTitle>
              <DialogDescription>
                Choose a name that others will see on the leaderboard instead of your wallet address.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter a display name"
                  maxLength={20}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nameInput.trim()) handleSaveName();
                  }}
                />
                <div className="flex justify-between mt-1.5">
                  <p className="text-xs text-muted-foreground">
                    2-20 characters. Letters, digits, spaces, hyphens.
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {nameInput.length}/20
                  </p>
                </div>
              </div>
              {(nameError || saveError) && (
                <p className="text-sm text-destructive">
                  {nameError || saveError?.message}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                {displayName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      setNameError(null);
                      try {
                        await updateProfile(address, null);
                        refetchProfile();
                        setShowNameDialog(false);
                      } catch (err) {
                        setNameError(err instanceof Error ? err.message : 'Failed to clear');
                      }
                    }}
                    disabled={savingName}
                    className="text-muted-foreground"
                  >
                    Clear Name
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNameDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveName}
                  disabled={savingName || !nameInput.trim() || nameInput.trim().length < 2}
                >
                  {savingName ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
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

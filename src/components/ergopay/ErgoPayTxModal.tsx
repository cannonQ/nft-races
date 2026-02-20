import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { isMobileDevice } from '@/lib/ergo/ergopay';
import { pollErgoPayTxStatus, type ErgoPayTxStatus } from '@/lib/ergo/ergopay-tx';

interface ErgoPayTxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ergoPayUrl: string;
  requestId: string;
  amount: number;
  description: string;
  onSuccess: (result: any, txId: string) => void;
  onExpired: () => void;
  /** Token amount (shown instead of ERG when present) */
  tokenAmount?: number;
  /** Token display name (e.g. "CYPX") */
  tokenName?: string;
}

type ModalState = 'waiting' | 'success' | 'expired' | 'failed';

export function ErgoPayTxModal({
  open,
  onOpenChange,
  ergoPayUrl,
  requestId,
  amount,
  description,
  onSuccess,
  onExpired,
  tokenAmount,
  tokenName,
}: ErgoPayTxModalProps) {
  const [state, setState] = useState<ModalState>('waiting');
  const [txId, setTxId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMobile = isMobileDevice();

  // Start polling when modal opens
  useEffect(() => {
    if (!open || !requestId) return;

    setState('waiting');
    setTxId(null);
    setErrorMsg(null);

    pollingRef.current = setInterval(async () => {
      try {
        const status = await pollErgoPayTxStatus(requestId);

        if (status.status === 'executed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setTxId(status.txId);
          setState('success');
          onSuccess(status.result, status.txId);
        } else if (status.status === 'expired') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setState('expired');
          onExpired();
        } else if (status.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setErrorMsg(status.error);
          setState('failed');
        }
      } catch {
        // Polling error — keep trying
      }
    }, 2500);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [open, requestId, onSuccess, onExpired]);

  const ergAmount = `${amount / 1_000_000_000}`;
  const displayAmount = tokenAmount != null && tokenName
    ? `${tokenAmount} ${tokenName}`
    : `${ergAmount} ERG`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cyber-card border-primary/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            {state === 'success' ? 'Payment Confirmed' :
             state === 'expired' ? 'Payment Expired' :
             state === 'failed' ? 'Payment Failed' :
             'Confirm Payment'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Fee amount */}
          <div className="cyber-card rounded-lg p-3 w-full">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono text-primary font-semibold">{displayAmount}</span>
            </div>
          </div>

          {/* Waiting state */}
          {state === 'waiting' && (
            <>
              {/* QR Code (desktop) */}
              {!isMobile && (
                <div className="bg-white rounded-xl p-4">
                  <QRCodeSVG
                    value={ergoPayUrl}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              )}

              {/* Deep link button (mobile) */}
              {isMobile && (
                <a
                  href={ergoPayUrl}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  Open in Wallet
                </a>
              )}

              {/* Waiting spinner */}
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Waiting for payment confirmation...</span>
              </div>
            </>
          )}

          {/* Success state */}
          {state === 'success' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <CheckCircle2 className="w-12 h-12 text-accent" />
              <p className="text-sm text-accent font-semibold">Payment confirmed!</p>
              {txId && (
                <p className="text-xs text-muted-foreground font-mono break-all">
                  TX: {txId}
                </p>
              )}
            </div>
          )}

          {/* Expired state */}
          {state === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <XCircle className="w-12 h-12 text-destructive" />
              <p className="text-sm text-destructive font-semibold">Payment request expired</p>
              <p className="text-xs text-muted-foreground text-center">
                The payment was not completed in time. Please try again.
              </p>
            </div>
          )}

          {/* Failed state */}
          {state === 'failed' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <AlertTriangle className="w-12 h-12 text-destructive" />
              <p className="text-sm text-destructive font-semibold">Action failed after payment</p>
              {errorMsg && (
                <p className="text-xs text-muted-foreground text-center">{errorMsg}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-muted-foreground/30"
          >
            {state === 'waiting' ? 'Cancel' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

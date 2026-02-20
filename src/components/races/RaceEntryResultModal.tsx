import { useState, useEffect } from 'react';
import { CheckCircle, Users, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Race, RaceType } from '@/types/game';
import { cn } from '@/lib/utils';

const EXPLORER_TX_URL = 'https://ergexplorer.com/transactions#';

const typeColors: Record<RaceType, string> = {
  sprint: 'text-race-sprint',
  distance: 'text-race-distance',
  technical: 'text-race-technical',
  mixed: 'text-race-mixed',
  hazard: 'text-race-hazard',
};

interface RaceEntryResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race: Race | null;
  enteredCount: number;
  /** On-chain transaction ID (Nautilus or ErgoPay) */
  txId?: string | null;
  /** Fee paid in ERG (e.g. 0.05) */
  feeErg?: number;
  /** Token fee info (when paid with token instead of ERG) */
  feeTokenName?: string;
  feeTokenAmount?: number;
}

export function RaceEntryResultModal({
  open,
  onOpenChange,
  race,
  enteredCount,
  txId,
  feeErg,
  feeTokenName,
  feeTokenAmount,
}: RaceEntryResultModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShowAnimation(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowAnimation(false);
    }
  }, [open]);

  if (!race) return null;

  // race.entryCount is stale (from before entry) since we defer refetch until modal close.
  // Add enteredCount to show the correct post-entry total.
  const totalEntries = race.entryCount + enteredCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cyber-card border-accent/30 max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center',
              'bg-accent/20 glow-green',
              showAnimation && 'animate-scale-in'
            )}>
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
          </div>
          <DialogTitle className="font-display text-2xl text-foreground text-center">
            Entry Confirmed!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Race info */}
          <div className="text-center">
            <p className="text-muted-foreground">
              {enteredCount > 1
                ? <><span className="text-primary font-semibold">{enteredCount} creatures</span> entered</>
                : <>Your creature entered</>
              }
              {' '}into
            </p>
            <p className={cn('font-display text-lg font-semibold mt-1', typeColors[race.raceType])}>
              {race.name}
            </p>
          </div>

          {/* Entries gauge */}
          <div className="cyber-card rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Entries
                </span>
              </div>
              <span className="font-mono text-lg font-bold text-foreground">
                {totalEntries} / {race.maxEntries}
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000 ease-out bg-primary',
                  showAnimation && 'animate-in'
                )}
                style={{
                  width: showAnimation
                    ? `${Math.min((totalEntries / race.maxEntries) * 100, 100)}%`
                    : `${Math.min(((totalEntries - enteredCount) / race.maxEntries) * 100, 100)}%`,
                }}
              />
            </div>
            {totalEntries >= race.maxEntries && (
              <p className="text-xs text-accent mt-2 text-center font-semibold">
                Race is full — starting soon!
              </p>
            )}
          </div>
        </div>

        {/* TX confirmation banner */}
        {txId && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-accent/10 border border-accent/20 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-accent font-semibold uppercase tracking-wider">
                Payment Confirmed
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {feeTokenAmount != null && feeTokenName
                  ? `${feeTokenAmount} ${feeTokenName}`
                  : feeErg != null ? `${feeErg} ERG` : 'Fee'} paid on-chain
              </p>
            </div>
            <a
              href={`${EXPLORER_TX_URL}${txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-mono shrink-0 transition-colors"
            >
              {txId.slice(0, 8)}...
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <div className="flex justify-center">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 glow-green px-8"
          >
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

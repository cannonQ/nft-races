import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Flame, Check, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreatureWithStats, TrainingActivity, StatType, FeeToken, PaymentCurrency } from '@/types/game';
import { PaymentSelector } from '@/components/ui/PaymentSelector';
import { cn } from '@/lib/utils';

const PER_STAT_CAP = 80;
const BLOCKS_PER_DAY = 720;

/** Round to 2 decimal places for display */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Estimate time remaining from block heights */
function blocksToTimeLabel(blocksLeft: number): string {
  if (blocksLeft <= 0) return 'Expired';
  const days = blocksLeft / BLOCKS_PER_DAY;
  if (days >= 1) return `~${days.toFixed(1)}d left`;
  const hours = days * 24;
  return `~${Math.round(hours)}h left`;
}

interface TrainingConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creature: CreatureWithStats;
  activity: TrainingActivity | null;
  currentBlockHeight: number | null;
  onConfirm: (selectedBoostIds: string[], paymentCurrency?: PaymentCurrency) => void;
  requireFees?: boolean;
  walletType?: 'nautilus' | 'ergopay' | null;
  /** When true, show spinner on button and prevent close (TX is being signed) */
  submitting?: boolean;
  feeToken?: FeeToken | null;
  trainingFeeNanoerg?: number;
  trainingFeeToken?: number;
}

const statLabels: Record<StatType, string> = {
  speed: 'Speed',
  stamina: 'Stamina',
  accel: 'Acceleration',
  agility: 'Agility',
  heart: 'Heart',
  focus: 'Focus',
};

const statColors: Record<StatType, string> = {
  speed: 'text-stat-speed',
  stamina: 'text-stat-stamina',
  accel: 'text-stat-acceleration',
  agility: 'text-stat-agility',
  heart: 'text-stat-heart',
  focus: 'text-stat-focus',
};

export function TrainingConfirmModal({
  open,
  onOpenChange,
  creature,
  activity,
  currentBlockHeight,
  onConfirm,
  requireFees,
  walletType,
  submitting,
  feeToken,
  trainingFeeNanoerg,
  trainingFeeToken,
}: TrainingConfirmModalProps) {
  const [selectedBoostIds, setSelectedBoostIds] = useState<Set<string>>(new Set());
  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>('erg');

  // Reset selection when modal opens — default to token if available
  useEffect(() => {
    if (open) {
      setSelectedBoostIds(new Set());
      setPaymentCurrency(feeToken ? 'token' : 'erg');
    }
  }, [open, feeToken, walletType]);

  if (!activity) return null;

  const availableBoosts = creature.boosts ?? [];

  const toggleBoost = (id: string) => {
    setSelectedBoostIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedBoostIds(new Set(availableBoosts.map(b => b.id)));
  const clearAll = () => setSelectedBoostIds(new Set());

  // Compute selected boost total
  const selectedBoostTotal = availableBoosts
    .filter(b => selectedBoostIds.has(b.id))
    .reduce((sum, b) => sum + b.multiplier, 0);

  const isRecovery = activity.primaryGain === 0 && activity.fatigueCost < 0;
  const newFatigue = Math.max(0, Math.min(100, creature.fatigue + activity.fatigueCost));
  const isHighFatigue = newFatigue >= 80;
  const newSharpness = Math.max(0, Math.min(100, creature.sharpness + activity.sharpnessDelta));
  const sharpnessChange = activity.sharpnessDelta;

  // Diminishing returns: gain = base_gain * (1 - trained_stat / 80)
  const trainedPrimary = creature.trainedStats[activity.primaryStat];
  const rawPrimaryGain = activity.primaryGain * (1 - trainedPrimary / PER_STAT_CAP);

  const trainedSecondary = activity.secondaryStat
    ? creature.trainedStats[activity.secondaryStat]
    : 0;
  const rawSecondaryGain = activity.secondaryStat
    ? activity.secondaryGain * (1 - trainedSecondary / PER_STAT_CAP)
    : 0;

  // Apply selected boost multiplier
  const boost = selectedBoostTotal;
  const primaryGain = r2(boost > 0 ? rawPrimaryGain * (1 + boost) : rawPrimaryGain);
  const secondaryGain = r2(boost > 0 ? rawSecondaryGain * (1 + boost) : rawSecondaryGain);

  const currentPrimary = r2(creature.baseStats[activity.primaryStat] + trainedPrimary);
  const newPrimary = r2(currentPrimary + primaryGain);

  const currentSecondary = activity.secondaryStat
    ? r2(creature.baseStats[activity.secondaryStat] + trainedSecondary)
    : 0;
  const newSecondary = r2(currentSecondary + secondaryGain);

  const handleClose = (value: boolean) => {
    if (submitting) return;
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="cyber-card border-primary/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            {isRecovery ? 'Confirm Recovery' : 'Confirm Training'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isRecovery ? 'Rest' : 'Train'} <span className="text-primary font-semibold">{creature.name}</span> with{' '}
            <span className="text-foreground font-semibold">{activity.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Boost Selector (hidden for recovery — boosts multiply 0 gains) */}
          {!isRecovery && availableBoosts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Apply Boosts
                </h4>
                <div className="flex gap-1">
                  <button
                    onClick={selectAll}
                    className="text-[10px] text-primary hover:text-primary/80 font-semibold uppercase"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground text-[10px]">/</span>
                  <button
                    onClick={clearAll}
                    className="text-[10px] text-muted-foreground hover:text-foreground font-semibold uppercase"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {availableBoosts.map(b => {
                  const isSelected = selectedBoostIds.has(b.id);
                  const blocksLeft = currentBlockHeight ? b.expiresAtHeight - currentBlockHeight : 0;
                  return (
                    <button
                      key={b.id}
                      onClick={() => toggleBoost(b.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono',
                        'border transition-all duration-150',
                        isSelected
                          ? 'bg-primary/20 border-primary/50 text-primary shadow-[0_0_8px_hsl(var(--primary)/0.3)]'
                          : 'bg-muted/50 border-border text-muted-foreground hover:border-primary/30'
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <Flame className="w-3 h-3" />
                      +{Math.round(b.multiplier * 100)}%
                      <span className="text-[10px] opacity-60">
                        {blocksToTimeLabel(blocksLeft)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedBoostTotal > 0 && (
                <div className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold">
                  <Flame className="w-3 h-3" />
                  Total Boost: +{Math.round(selectedBoostTotal * 100)}%
                </div>
              )}
            </div>
          )}

          {/* Stat Changes (hidden for recovery activities) */}
          {!isRecovery && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Projected Gains
              </h4>

              <div className="cyber-card rounded-lg p-3 space-y-2">
                {/* Primary Stat */}
                <div className="flex items-center justify-between">
                  <span className={cn('font-mono text-sm', statColors[activity.primaryStat])}>
                    {statLabels[activity.primaryStat]}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="text-muted-foreground">{currentPrimary}</span>
                    <TrendingUp className="w-3 h-3 text-accent" />
                    <span className={statColors[activity.primaryStat]}>{newPrimary}</span>
                    <span className="text-accent text-xs">(+{primaryGain})</span>
                  </div>
                </div>

                {/* Secondary Stat */}
                {activity.secondaryStat && (
                  <div className="flex items-center justify-between">
                    <span className={cn('font-mono text-sm', statColors[activity.secondaryStat])}>
                      {statLabels[activity.secondaryStat]}
                    </span>
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <span className="text-muted-foreground">{currentSecondary}</span>
                      <TrendingUp className="w-3 h-3 text-accent" />
                      <span className={statColors[activity.secondaryStat]}>{newSecondary}</span>
                      <span className="text-accent text-xs">(+{secondaryGain})</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recovery Effects (shown for recovery activities) */}
          {isRecovery && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recovery Effects
              </h4>

              <div className="cyber-card rounded-lg p-3 space-y-3">
                {/* Fatigue reduction */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-muted-foreground flex items-center gap-1.5">
                    <ArrowDown className="w-3.5 h-3.5 text-accent" />
                    Fatigue
                  </span>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="text-muted-foreground">{Math.round(creature.fatigue)}%</span>
                    <span className="text-muted-foreground">&rarr;</span>
                    <span className="text-accent font-bold">{Math.round(newFatigue)}%</span>
                    <span className="text-accent text-xs">({activity.fatigueCost}%)</span>
                  </div>
                </div>

                {/* Fatigue bar */}
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      newFatigue <= 30 ? 'bg-stat-stamina' :
                      newFatigue <= 60 ? 'bg-stat-acceleration' :
                      'bg-destructive'
                    )}
                    style={{ width: `${newFatigue}%` }}
                  />
                </div>

                {/* Sharpness gain */}
                {sharpnessChange > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="font-mono text-sm text-muted-foreground flex items-center gap-1.5">
                      <ArrowUp className="w-3.5 h-3.5 text-accent" />
                      Sharpness
                    </span>
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <span className="text-muted-foreground">{Math.round(creature.sharpness)}%</span>
                      <span className="text-muted-foreground">&rarr;</span>
                      <span className="text-accent font-bold">{Math.round(newSharpness)}%</span>
                      <span className="text-accent text-xs">(+{sharpnessChange})</span>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                No stat gains. Uses 1 daily action.
              </p>
            </div>
          )}

          {/* Fatigue Change (hidden for recovery — already shown above) */}
          {!isRecovery && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Fatigue Impact
              </h4>

              <div className={cn(
                'cyber-card rounded-lg p-3',
                isHighFatigue && 'border-destructive/50'
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-muted-foreground">Fatigue Level</span>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="text-muted-foreground">{Math.round(creature.fatigue)}%</span>
                    <span className="text-muted-foreground">&rarr;</span>
                    <span className={cn(
                      isHighFatigue ? 'text-destructive' : 'text-foreground'
                    )}>
                      {Math.round(newFatigue)}%
                    </span>
                  </div>
                </div>

                {/* Fatigue bar */}
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      newFatigue <= 30 ? 'bg-stat-stamina' :
                      newFatigue <= 60 ? 'bg-stat-acceleration' :
                      'bg-destructive'
                    )}
                    style={{ width: `${newFatigue}%` }}
                  />
                </div>
              </div>

              {isHighFatigue && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    High fatigue warning! Your creature may perform poorly in races and risk injury.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sharpness Impact (hidden for recovery — already shown in Recovery Effects) */}
          {!isRecovery && sharpnessChange !== 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sharpness Impact
              </h4>

              <div className="cyber-card rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-muted-foreground">Sharpness</span>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="text-muted-foreground">{Math.round(creature.sharpness)}%</span>
                    <span className="text-muted-foreground">&rarr;</span>
                    <span className={cn(
                      sharpnessChange > 0 ? 'text-accent' : 'text-destructive'
                    )}>
                      {Math.round(newSharpness)}%
                    </span>
                    <span className={cn(
                      'text-xs flex items-center gap-0.5',
                      sharpnessChange > 0 ? 'text-accent' : 'text-destructive'
                    )}>
                      {sharpnessChange > 0 ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )}
                      {sharpnessChange > 0 ? '+' : ''}{sharpnessChange}
                    </span>
                  </div>
                </div>

                {/* Sharpness bar */}
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      newSharpness >= 70 ? 'bg-accent' :
                      newSharpness >= 40 ? 'bg-stat-acceleration' :
                      'bg-destructive'
                    )}
                    style={{ width: `${newSharpness}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fee Info (when fees enabled) */}
        {requireFees && (
          <div className="space-y-2">
            {feeToken && trainingFeeToken && (walletType === 'nautilus' || walletType === 'ergopay') ? (
              <PaymentSelector
                feeToken={feeToken}
                ergAmount={`${(trainingFeeNanoerg ?? 10_000_000) / 1_000_000_000}`}
                tokenAmount={trainingFeeToken}
                selected={paymentCurrency}
                onSelect={setPaymentCurrency}
              />
            ) : (
              <div className="cyber-card rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Training Fee</span>
                  <span className="font-mono text-primary font-semibold">
                    {(trainingFeeNanoerg ?? 10_000_000) / 1_000_000_000} ERG
                  </span>
                </div>
              </div>
            )}
            {walletType === 'ergopay' && (
              <p className="text-[10px] text-muted-foreground">
                You will be prompted to confirm payment in your wallet app.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={submitting}
            className="border-muted-foreground/30"
          >
            Cancel
          </Button>
          <Button
            onClick={() => !submitting && onConfirm(Array.from(selectedBoostIds), requireFees ? paymentCurrency : undefined)}
            disabled={submitting}
            className={cn(
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'glow-cyan'
            )}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                Signing...
              </>
            ) : (
              requireFees
                ? paymentCurrency === 'token' && feeToken && trainingFeeToken
                  ? (isRecovery ? `Pay & Recover (${trainingFeeToken} ${feeToken.name})` : `Pay & Train (${trainingFeeToken} ${feeToken.name})`)
                  : (isRecovery ? `Pay & Recover (${(trainingFeeNanoerg ?? 10_000_000) / 1_000_000_000} ERG)` : `Pay & Train (${(trainingFeeNanoerg ?? 10_000_000) / 1_000_000_000} ERG)`)
                : (isRecovery ? 'Begin Recovery' : 'Start Training')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

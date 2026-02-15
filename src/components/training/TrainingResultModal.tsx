import { useState, useEffect } from 'react';
import { CheckCircle, Sparkles, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreatureWithStats, TrainingActivity, TrainResponse, StatType, StatBlock } from '@/types/game';
import { cn } from '@/lib/utils';

const EXPLORER_TX_URL = 'https://ergexplorer.com/transactions#';

interface TrainingResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creature: CreatureWithStats;
  activity: TrainingActivity | null;
  boostMultiplier?: number;
  /** Pre-training snapshot so we can show correct old→new even after refetch */
  preTrainStats?: { trained: StatBlock; base: StatBlock } | null;
  trainResult?: TrainResponse | null;
  /** On-chain transaction ID (Nautilus or ErgoPay) */
  txId?: string | null;
  /** Fee paid in ERG (e.g. 0.01) */
  feeErg?: number;
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

/** Round to 2 decimal places for display */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface AnimatedNumberProps {
  from: number;
  to: number;
  className?: string;
}

function AnimatedNumber({ from, to, className }: AnimatedNumberProps) {
  const [current, setCurrent] = useState(from);

  useEffect(() => {
    const duration = 1000;
    const steps = 20;
    const increment = (to - from) / steps;
    const stepDuration = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step >= steps) {
        setCurrent(to);
        clearInterval(timer);
      } else {
        setCurrent(r2(from + increment * step));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [from, to]);

  return <span className={className}>{r2(current)}</span>;
}

export function TrainingResultModal({
  open,
  onOpenChange,
  creature,
  activity,
  boostMultiplier = 0,
  preTrainStats,
  trainResult,
  txId,
  feeErg,
}: TrainingResultModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShowAnimation(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowAnimation(false);
    }
  }, [open]);

  if (!activity) return null;

  // Use the pre-training snapshot for "old" values (before refetch overwrites creature)
  const baseStats = preTrainStats?.base ?? creature.baseStats;
  const oldTrained = preTrainStats?.trained ?? creature.trainedStats;

  // Boost: use the actual total from server response, fallback to pre-train snapshot
  const hasBoost = trainResult ? trainResult.boostUsed : boostMultiplier > 0;
  const boostPercent = trainResult?.totalBoostMultiplier
    ? Math.round(trainResult.totalBoostMultiplier * 100)
    : Math.round(boostMultiplier * 100);

  // Actual gains from server response
  const primaryGain = r2(trainResult?.statChanges[activity.primaryStat] ?? 0);
  const secondaryGain = activity.secondaryStat
    ? r2(trainResult?.statChanges[activity.secondaryStat] ?? 0)
    : 0;

  // Old = base + pre-training trained stat
  const oldPrimary = r2(baseStats[activity.primaryStat] + oldTrained[activity.primaryStat]);
  // New = base + server's newStats (which is the new trained value)
  const newPrimary = trainResult
    ? r2(trainResult.newStats[activity.primaryStat] + baseStats[activity.primaryStat])
    : r2(oldPrimary + primaryGain);

  const oldSecondary = activity.secondaryStat
    ? r2(baseStats[activity.secondaryStat] + oldTrained[activity.secondaryStat])
    : 0;
  const newSecondary = activity.secondaryStat && trainResult
    ? r2(trainResult.newStats[activity.secondaryStat] + baseStats[activity.secondaryStat])
    : r2(oldSecondary + secondaryGain);

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
            Training Complete!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Activity completed */}
          <div className="text-center">
            <p className="text-muted-foreground">
              <span className="text-primary font-semibold">{creature.name}</span> completed{' '}
              <span className="text-foreground font-semibold">{activity.name}</span>
            </p>
            {hasBoost && (
              <p className="text-orange-400 text-sm mt-1 font-semibold">
                +{boostPercent}% Boost Applied!
              </p>
            )}
          </div>

          {/* Animated stat gains */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
              Stats Improved
            </h4>

            <div className="cyber-card rounded-lg p-4 space-y-4">
              {/* Primary Stat */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className={cn('w-4 h-4', statColors[activity.primaryStat])} />
                  <span className={cn('font-display text-sm', statColors[activity.primaryStat])}>
                    {statLabels[activity.primaryStat]}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl text-muted-foreground">{oldPrimary}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={cn('font-mono text-3xl font-bold', statColors[activity.primaryStat])}>
                    {showAnimation ? (
                      <AnimatedNumber from={oldPrimary} to={newPrimary} />
                    ) : (
                      oldPrimary
                    )}
                  </span>
                    <span className="text-accent font-mono text-lg">+{primaryGain}</span>
                  </div>

                {/* Animated bar */}
                <div className="mt-3 h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-1000 ease-out',
                      activity.primaryStat === 'speed' && 'bg-stat-speed',
                      activity.primaryStat === 'stamina' && 'bg-stat-stamina',
                      activity.primaryStat === 'accel' && 'bg-stat-acceleration',
                      activity.primaryStat === 'agility' && 'bg-stat-agility',
                      activity.primaryStat === 'heart' && 'bg-stat-heart',
                      activity.primaryStat === 'focus' && 'bg-stat-focus',
                    )}
                    style={{
                      width: showAnimation ? `${newPrimary}%` : `${oldPrimary}%`,
                    }}
                  />
                </div>
              </div>

              {/* Secondary Stat */}
              {activity.secondaryStat && secondaryGain > 0 && (
                <div className="text-center pt-3 border-t border-border">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Sparkles className={cn('w-3 h-3', statColors[activity.secondaryStat])} />
                    <span className={cn('font-display text-xs', statColors[activity.secondaryStat])}>
                      {statLabels[activity.secondaryStat]}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-lg text-muted-foreground">{oldSecondary}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={cn('font-mono text-xl font-bold', statColors[activity.secondaryStat])}>
                      {showAnimation ? (
                        <AnimatedNumber from={oldSecondary} to={newSecondary} />
                      ) : (
                        oldSecondary
                      )}
                    </span>
                    <span className="text-accent font-mono text-sm">+{secondaryGain}</span>
                  </div>

                  {/* Animated bar */}
                  <div className="mt-3 h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000 ease-out',
                        activity.secondaryStat === 'speed' && 'bg-stat-speed',
                        activity.secondaryStat === 'stamina' && 'bg-stat-stamina',
                        activity.secondaryStat === 'accel' && 'bg-stat-acceleration',
                        activity.secondaryStat === 'agility' && 'bg-stat-agility',
                        activity.secondaryStat === 'heart' && 'bg-stat-heart',
                        activity.secondaryStat === 'focus' && 'bg-stat-focus',
                      )}
                      style={{
                        width: showAnimation ? `${newSecondary}%` : `${oldSecondary}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {trainResult && (
          <div className="text-center text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{trainResult.actionsRemaining}</span> actions remaining today
          </div>
        )}

        {/* TX confirmation banner */}
        {txId && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-accent/10 border border-accent/20 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-accent font-semibold uppercase tracking-wider">
                Payment Confirmed
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {feeErg != null ? `${feeErg} ERG` : 'Fee'} paid on-chain
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
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

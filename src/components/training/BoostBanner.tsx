import { Flame, Sparkles } from 'lucide-react';
import { BoostReward } from '@/types/game';
import { cn } from '@/lib/utils';

const BLOCKS_PER_DAY = 720;

interface BoostBannerProps {
  boosts: BoostReward[];
  currentBlockHeight: number | null;
  className?: string;
}

export function BoostBanner({ boosts, currentBlockHeight, className }: BoostBannerProps) {
  if (!boosts || boosts.length === 0) return null;

  const totalPercent = Math.round(boosts.reduce((sum, b) => sum + b.multiplier, 0) * 100);

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl p-4 border',
      'bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10',
      'border-primary/30',
      className
    )}>
      {/* Animated glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-pulse" />

      <div className="relative flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Flame className="w-5 h-5 text-primary animate-pulse" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-primary">
              {boosts.length} Boost{boosts.length > 1 ? 's' : ''} Available
            </span>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {boosts.map(b => {
              const blocksLeft = currentBlockHeight ? b.expiresAtHeight - currentBlockHeight : 0;
              const daysLeft = blocksLeft / BLOCKS_PER_DAY;
              const timeLabel = daysLeft >= 1 ? `~${daysLeft.toFixed(1)}d` : `~${Math.round(daysLeft * 24)}h`;
              return (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono"
                >
                  +{Math.round(b.multiplier * 100)}%
                  <span className="opacity-50">{timeLabel}</span>
                </span>
              );
            })}
            <span className="text-xs text-muted-foreground">
              ({totalPercent}% total — select in confirm dialog)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

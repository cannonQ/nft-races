import { Trophy, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RewardBadgesProps {
  bonusActions: number;
  boostMultiplier: number;
  compact?: boolean;
}

export function RewardBadges({ bonusActions, boostMultiplier, compact = false }: RewardBadgesProps) {
  if (bonusActions === 0 && boostMultiplier === 0) return null;

  const boostPercent = Math.round(boostMultiplier * 100);

  return (
    <div className={cn('flex flex-wrap gap-1.5', compact ? 'mt-1' : 'mt-2')}>
      {/* Bonus Action Badge */}
      {bonusActions > 0 && (
        <div className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
          'bg-race-sprint/20 text-race-sprint border border-race-sprint/30',
          'animate-pulse shadow-[0_0_10px_hsl(var(--race-sprint)/0.4)]'
        )}>
          <Trophy className="w-3 h-3" />
          <span>{bonusActions > 1 ? `${bonusActions} Bonus Actions` : 'Bonus Action'}</span>
        </div>
      )}

      {/* Boost Multiplier Badge */}
      {boostMultiplier > 0 && (
        <div className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
          'bg-primary/20 text-primary border border-primary/30',
          'animate-pulse shadow-[0_0_10px_hsl(var(--primary)/0.4)]'
        )}>
          <Flame className="w-3 h-3" />
          <span>+{boostPercent}% Boost</span>
        </div>
      )}
    </div>
  );
}

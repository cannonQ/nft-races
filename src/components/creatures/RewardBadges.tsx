import { Trophy, Flame } from 'lucide-react';
import { BoostReward } from '@/types/game';
import { cn } from '@/lib/utils';

interface RewardBadgesProps {
  bonusActions: number;
  boosts: BoostReward[];
  compact?: boolean;
}

export function RewardBadges({ bonusActions, boosts, compact = false }: RewardBadgesProps) {
  if (bonusActions === 0 && boosts.length === 0) return null;

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

      {/* Boost Rewards Badge */}
      {boosts.length > 0 && (
        <div className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
          'bg-primary/20 text-primary border border-primary/30',
          'animate-pulse shadow-[0_0_10px_hsl(var(--primary)/0.4)]'
        )}>
          <Flame className="w-3 h-3" />
          <span>{boosts.length} Boost{boosts.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

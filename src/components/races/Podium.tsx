import { Trophy, Medal, Award } from 'lucide-react';
import { RaceEntry, Rarity } from '@/types/game';
import { useWallet } from '@/context/WalletContext';
import { truncateAddress } from '@/lib/ergo/client';
import { cn } from '@/lib/utils';

interface PodiumProps {
  results: RaceEntry[];
}

const rarityStyles: Record<Rarity, string> = {
  common: 'text-muted-foreground',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  masterwork: 'text-rarity-masterwork',
  epic: 'text-rarity-epic',
  relic: 'text-rarity-relic',
  legendary: 'text-rarity-legendary',
  mythic: 'text-rarity-mythic',
  cyberium: 'text-rarity-mythic',
};

const positionConfig = {
  1: {
    icon: Trophy,
    color: 'text-race-sprint',
    bg: 'bg-race-sprint/20',
    border: 'border-race-sprint/50',
    height: 'h-32',
    order: 'order-2',
    label: '1st',
  },
  2: {
    icon: Medal,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30',
    border: 'border-muted-foreground/30',
    height: 'h-24',
    order: 'order-1',
    label: '2nd',
  },
  3: {
    icon: Award,
    color: 'text-race-hazard',
    bg: 'bg-race-hazard/20',
    border: 'border-race-hazard/50',
    height: 'h-20',
    order: 'order-3',
    label: '3rd',
  },
};

export function Podium({ results }: PodiumProps) {
  const { address } = useWallet();
  const topThree = results.slice(0, 3);

  if (topThree.length === 0) {
    return null;
  }

  return (
    <div className="flex items-end justify-center gap-3 md:gap-6 py-8">
      {topThree.map((result) => {
        const config = positionConfig[result.position as 1 | 2 | 3];
        if (!config) return null;

        const Icon = config.icon;
        const isCurrentUser = result.ownerAddress === address;

        return (
          <div
            key={result.creatureId}
            className={cn('flex flex-col items-center', config.order)}
          >
            {/* Creature Card */}
            <div
              className={cn(
                'cyber-card rounded-xl p-3 md:p-4 mb-2 text-center transition-all duration-300 min-w-[100px] md:min-w-[140px]',
                isCurrentUser && 'ring-2 ring-primary/50'
              )}
            >
              <Icon className={cn('w-8 h-8 mx-auto mb-2', config.color)} />
              <p
                className={cn(
                  'font-display text-sm font-semibold truncate',
                  isCurrentUser ? 'text-primary' : 'text-foreground'
                )}
              >
                {result.creatureName}
              </p>
              <p
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider mt-1',
                  rarityStyles[result.rarity]
                )}
              >
                {result.rarity}
              </p>
              <p className={cn(
                'text-xs text-muted-foreground mt-2 truncate max-w-[120px] md:max-w-[130px]',
                !result.ownerDisplayName && 'font-mono'
              )}>
                {result.ownerDisplayName || truncateAddress(result.ownerAddress)}
              </p>
              {isCurrentUser && (
                <span className="text-[10px] text-primary/70">(You)</span>
              )}
            </div>

            {/* Podium Stand */}
            <div
              className={cn(
                'w-full rounded-t-lg border-t-2 border-x-2 flex flex-col items-center justify-start pt-3',
                config.height,
                config.bg,
                config.border
              )}
            >
              <span
                className={cn('font-display text-2xl font-bold', config.color)}
              >
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground font-mono mt-1">
                {result.performanceScore.toLocaleString()} pts
              </span>
              <span className={cn('text-sm font-semibold mt-1', config.color)}>
                +{result.payout.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

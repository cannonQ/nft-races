import { RaceEntry, Rarity } from '@/types/game';
import { useWallet } from '@/context/WalletContext';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Trophy, Flame, Zap, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ResultsTableProps {
  results: RaceEntry[];
}

const rarityStyles: Record<Rarity, string> = {
  common: 'text-muted-foreground',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
  mythic: 'text-rarity-mythic',
  cyberium: 'text-rarity-mythic',
};

// Reward indicators by position
function getPositionReward(position: number) {
  switch (position) {
    case 1:
      return {
        icon: Trophy,
        text: '+1 Bonus Action',
        color: 'text-race-sprint',
        bg: 'bg-race-sprint/10',
      };
    case 2:
      return {
        icon: Flame,
        text: '+50% Boost',
        color: 'text-primary',
        bg: 'bg-primary/10',
      };
    case 3:
      return {
        icon: Zap,
        text: '+25% Boost',
        color: 'text-secondary',
        bg: 'bg-secondary/10',
      };
    default:
      return {
        icon: Sparkles,
        text: '+10% Boost',
        color: 'text-muted-foreground',
        bg: 'bg-muted/50',
      };
  }
}

function BreakdownRow({ result }: { result: RaceEntry }) {
  const [isOpen, setIsOpen] = useState(false);
  const { address } = useWallet();
  const isCurrentUser = result.ownerAddress === address;
  const hasBreakdown = !!result.breakdown;
  const reward = getPositionReward(result.position);
  const RewardIcon = reward.icon;

  const content = (
    <div
      className={cn(
        'grid grid-cols-12 gap-2 md:gap-4 items-center p-3 rounded-lg transition-colors',
        isCurrentUser ? 'bg-primary/10' : 'bg-muted/30',
        hasBreakdown && 'cursor-pointer hover:bg-muted/50'
      )}
    >
      {/* Position */}
      <div className="col-span-1 text-center">
        <span
          className={cn(
            'font-mono text-sm font-semibold',
            result.position === 1 && 'text-race-sprint',
            result.position === 2 && 'text-muted-foreground',
            result.position === 3 && 'text-race-hazard',
            result.position > 3 && 'text-foreground'
          )}
        >
          {result.position}
        </span>
      </div>

      {/* Creature */}
      <div className="col-span-4 md:col-span-3">
        <p
          className={cn(
            'font-medium text-sm truncate',
            isCurrentUser ? 'text-primary' : 'text-foreground'
          )}
        >
          {result.creatureName}
          {isCurrentUser && (
            <span className="ml-1 text-[10px] text-primary/70">(You)</span>
          )}
        </p>
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wider',
            rarityStyles[result.rarity]
          )}
        >
          {result.rarity}
        </span>
      </div>

      {/* Reward Badge */}
      <div className="col-span-3 hidden md:block">
        <div className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
          reward.bg, reward.color
        )}>
          <RewardIcon className="w-3 h-3" />
          <span>{reward.text}</span>
        </div>
      </div>

      {/* Score */}
      <div className="col-span-3 md:col-span-2 text-center">
        <span className="font-mono text-sm text-foreground">
          {result.performanceScore.toLocaleString()}
        </span>
      </div>

      {/* Payout */}
      <div className="col-span-3 md:col-span-2 text-right flex items-center justify-end gap-2">
        <span
          className={cn(
            'font-mono text-sm font-semibold',
            result.payout > 0 ? 'text-secondary' : 'text-muted-foreground'
          )}
        >
          {result.payout > 0 ? `+${result.payout.toLocaleString()}` : '-'}
        </span>
        {hasBreakdown && (
          isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )
        )}
      </div>
    </div>
  );

  if (!hasBreakdown) {
    return content;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        {content}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-8 mr-4 mb-2 p-3 rounded-lg bg-background/50 border border-border/50">
          <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">
            Score Breakdown
          </p>
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-muted-foreground">Weighted</p>
              <p className="font-mono text-foreground">
                {result.breakdown?.weightedScore.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Fatigue</p>
              <p className="font-mono text-destructive">
                {result.breakdown?.fatigueMod}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Sharpness</p>
              <p className="font-mono text-primary">
                +{result.breakdown?.sharpnessMod}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Final</p>
              <p className="font-mono text-foreground font-semibold">
                {result.breakdown?.finalScore.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ResultsTable({ results }: ResultsTableProps) {
  return (
    <div className="cyber-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 md:gap-4 items-center p-3 bg-muted/50 border-b border-border/50 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-4 md:col-span-3">Creature</div>
        <div className="col-span-3 hidden md:block">Reward</div>
        <div className="col-span-3 md:col-span-2 text-center">Score</div>
        <div className="col-span-3 md:col-span-2 text-right">Payout</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/30">
        {results.map((result) => (
          <BreakdownRow key={result.creatureId} result={result} />
        ))}
      </div>
    </div>
  );
}

import { RaceEntry, RaceType, Rarity, StatType } from '@/types/game';
import { useWallet } from '@/context/WalletContext';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Trophy, Flame, Zap, Sparkles, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ResultsTableProps {
  results: RaceEntry[];
  raceType?: RaceType;
  blockHash?: string | null;
}

const statLabels: Record<StatType, string> = {
  speed: 'SPD',
  stamina: 'STM',
  accel: 'ACC',
  agility: 'AGI',
  heart: 'HRT',
  focus: 'FOC',
};

const statFullNames: Record<StatType, string> = {
  speed: 'Speed',
  stamina: 'Stamina',
  accel: 'Acceleration',
  agility: 'Agility',
  heart: 'Heart',
  focus: 'Focus',
};

function formatMod(value: number): { text: string; color: string } {
  const pct = (value - 1) * 100;
  if (Math.abs(pct) < 0.05) return { text: '0%', color: 'text-muted-foreground' };
  const sign = pct > 0 ? '+' : '';
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    color: pct > 0 ? 'text-secondary' : 'text-destructive',
  };
}

function formatRng(value: number): { text: string; color: string } {
  const pct = value * 100;
  if (Math.abs(pct) < 0.05) return { text: '0%', color: 'text-muted-foreground' };
  const sign = pct > 0 ? '+' : '';
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    color: pct > 0 ? 'text-secondary' : 'text-destructive',
  };
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

function truncateHash(hash: string, chars = 8): string {
  return hash.length > chars * 2 + 3
    ? `${hash.slice(0, chars)}...${hash.slice(-chars)}`
    : hash;
}

function BreakdownRow({ result, blockHash }: { result: RaceEntry; blockHash?: string | null }) {
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
        {result.breakdown && (
          <div className="ml-4 md:ml-8 mr-4 mb-2 p-4 rounded-lg bg-background/50 border border-border/50 space-y-3">
            {/* Step 1: Stat Weights — show what mattered */}
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                Stat Contributions
              </p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {(['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'] as const).map((stat) => {
                  const effective = result.breakdown!.effectiveStats[stat] ?? 0;
                  const weight = result.breakdown!.raceTypeWeights?.[stat] ?? 0;
                  const contribution = effective * weight;
                  const isKeystat = weight >= 0.20;
                  return (
                    <div
                      key={stat}
                      className={cn(
                        'rounded px-2 py-1.5 text-center border',
                        isKeystat
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border/30 bg-muted/20'
                      )}
                    >
                      <p className={cn(
                        'text-[10px] font-semibold uppercase',
                        isKeystat ? 'text-primary' : 'text-muted-foreground'
                      )}>
                        {statLabels[stat]}
                      </p>
                      <p className="font-mono text-xs text-foreground">
                        {effective.toFixed(1)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {weight > 0 ? `×${weight.toFixed(2)}` : '—'}
                      </p>
                      {weight > 0 && (
                        <p className={cn(
                          'font-mono text-[10px] font-semibold',
                          isKeystat ? 'text-primary' : 'text-foreground'
                        )}>
                          {contribution.toFixed(1)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Score Pipeline — Base → Modifiers → Final */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
              {/* Base Power */}
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Base Power</p>
                <p className="font-mono text-sm font-semibold text-foreground">
                  {result.breakdown.weightedScore.toFixed(1)}
                </p>
              </div>

              <ArrowRight className="w-3 h-3 text-muted-foreground hidden sm:block" />

              {/* Fatigue */}
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">
                  Fatigue <span className="font-mono">({result.breakdown.fatigue ?? '?'})</span>
                </p>
                <p className={cn('font-mono text-sm font-semibold', formatMod(result.breakdown.fatigueMod).color)}>
                  {formatMod(result.breakdown.fatigueMod).text}
                </p>
              </div>

              <ArrowRight className="w-3 h-3 text-muted-foreground hidden sm:block" />

              {/* Sharpness */}
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">
                  Sharpness <span className="font-mono">({result.breakdown.sharpness ?? '?'})</span>
                </p>
                <p className={cn('font-mono text-sm font-semibold', formatMod(result.breakdown.sharpnessMod).color)}>
                  {formatMod(result.breakdown.sharpnessMod).text}
                </p>
              </div>

              <ArrowRight className="w-3 h-3 text-muted-foreground hidden sm:block" />

              {/* Luck (RNG) */}
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Luck</p>
                <p className={cn('font-mono text-sm font-semibold', formatRng(result.breakdown.rngMod).color)}>
                  {formatRng(result.breakdown.rngMod).text}
                </p>
              </div>


              <ArrowRight className="w-3 h-3 text-muted-foreground hidden sm:block" />

              {/* Final Score */}
              <div className="text-center px-3 py-1 rounded bg-primary/10 border border-primary/20">
                <p className="text-[10px] text-primary">Final</p>
                <p className="font-mono text-sm font-bold text-primary">
                  {result.breakdown.finalScore.toFixed(3)}
                </p>
              </div>
            </div>

            {/* Formula hint */}
            <p className="text-[10px] text-muted-foreground/60 italic">
              Final = Base Power × Fatigue × Sharpness × (1 + Luck)
            </p>

            {/* Luck seed provenance */}
            {blockHash && (
              <div className="pt-2 border-t border-border/20 space-y-1">
                <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
                  Luck Seed (Verifiable)
                </p>
                <div className="flex flex-col gap-0.5 text-[10px] font-mono text-muted-foreground/50">
                  <span>Block: <span className="text-muted-foreground/70 select-all">{truncateHash(blockHash, 12)}</span></span>
                  <span>Creature: <span className="text-muted-foreground/70 select-all">{truncateHash(result.creatureId, 12)}</span></span>
                  <span className="text-muted-foreground/40 italic">seed = sha256(blockHash + creatureId) → luck swing scaled by Focus</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ResultsTable({ results, raceType, blockHash }: ResultsTableProps) {
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
          <BreakdownRow key={result.creatureId} result={result} blockHash={blockHash} />
        ))}
      </div>
    </div>
  );
}

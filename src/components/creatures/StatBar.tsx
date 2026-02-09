import { Rarity, StatType } from '@/types/game';
import { cn } from '@/lib/utils';

interface StatBarProps {
  stat: StatType;
  baseValue: number;
  trainedValue: number;
  maxValue?: number;
}

const statColors: Record<StatType, string> = {
  speed: 'bg-stat-speed',
  stamina: 'bg-stat-stamina',
  accel: 'bg-stat-acceleration',
  agility: 'bg-stat-agility',
  heart: 'bg-stat-heart',
  focus: 'bg-stat-focus',
};

const statLabels: Record<StatType, string> = {
  speed: 'SPD',
  stamina: 'STA',
  accel: 'ACC',
  agility: 'AGI',
  heart: 'HRT',
  focus: 'FOC',
};

export function StatBar({ stat, baseValue, trainedValue, maxValue = 100 }: StatBarProps) {
  const totalValue = Math.min(baseValue + trainedValue, maxValue);
  const basePercent = (baseValue / maxValue) * 100;
  const totalPercent = (totalValue / maxValue) * 100;

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-muted-foreground w-7">{statLabels[stat]}</span>
      <div className="flex-1 stat-bar">
        {/* Base stat */}
        <div 
          className={cn('stat-bar-fill', statColors[stat])}
          style={{ 
            width: `${totalPercent}%`,
            opacity: 0.9,
          }}
        />
        {/* Trained overlay - brighter section */}
        {trainedValue > 0 && (
          <div 
            className={cn('absolute top-0 h-full rounded-full', statColors[stat])}
            style={{ 
              left: `${basePercent}%`,
              width: `${(trainedValue / maxValue) * 100}%`,
              filter: 'brightness(1.3)',
            }}
          />
        )}
      </div>
      <span className="font-mono text-xs text-foreground w-8 text-right">
        {totalValue}
      </span>
    </div>
  );
}

interface ConditionGaugeProps {
  type: 'fatigue' | 'sharpness';
  value: number;
}

export function ConditionGauge({ type, value }: ConditionGaugeProps) {
  const isFatigue = type === 'fatigue';
  
  // Fatigue: green (low) to red (high)
  // Sharpness: dim (low) to bright cyan (high)
  const getColor = () => {
    if (isFatigue) {
      if (value <= 30) return 'bg-stat-stamina';
      if (value <= 60) return 'bg-stat-acceleration';
      return 'bg-destructive';
    } else {
      return value > 50 ? 'bg-primary' : 'bg-primary/40';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[10px] text-muted-foreground w-12">
        {isFatigue ? 'FATIGUE' : 'SHARP'}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div 
          className={cn('h-full rounded-full transition-all duration-500', getColor())}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground w-6 text-right">
        {value}%
      </span>
    </div>
  );
}

interface RarityBadgeProps {
  rarity: Rarity;
  className?: string;
}

const rarityStyles: Record<Rarity, { bg: string; text: string; className?: string }> = {
  common: { bg: 'bg-rarity-common/20', text: 'text-rarity-common' },
  uncommon: { bg: 'bg-rarity-uncommon/20', text: 'text-rarity-uncommon' },
  rare: { bg: 'bg-rarity-rare/20', text: 'text-rarity-rare' },
  epic: { bg: 'bg-rarity-epic/20', text: 'text-rarity-epic' },
  legendary: { bg: 'bg-rarity-legendary/20', text: 'text-rarity-legendary' },
  mythic: { bg: 'bg-rarity-mythic/20', text: 'text-rarity-mythic' },
  cyberium: { bg: 'bg-gradient-to-r from-neon-cyan/20 via-neon-magenta/20 to-neon-green/20', text: '', className: 'holographic' },
};

const defaultRarityStyle: { bg: string; text: string; className?: string } = { bg: 'bg-muted/50', text: 'text-muted-foreground' };

export function RarityBadge({ rarity, className }: RarityBadgeProps) {
  const style = rarityStyles[rarity] ?? defaultRarityStyle;

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
      style.bg,
      style.text,
      style.className,
      className
    )}>
      {rarity}
    </span>
  );
}

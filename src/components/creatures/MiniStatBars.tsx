import { useState } from 'react';
import type { StatBlock, StatType } from '@/types/game';
import { cn } from '@/lib/utils';

const STATS: { key: StatType; label: string; color: string }[] = [
  { key: 'speed', label: 'SPD', color: 'bg-stat-speed' },
  { key: 'stamina', label: 'STA', color: 'bg-stat-stamina' },
  { key: 'accel', label: 'ACC', color: 'bg-stat-acceleration' },
  { key: 'agility', label: 'AGI', color: 'bg-stat-agility' },
  { key: 'heart', label: 'HRT', color: 'bg-stat-heart' },
  { key: 'focus', label: 'FOC', color: 'bg-stat-focus' },
];

interface MiniStatBarsProps {
  baseStats: StatBlock;
  trainedStats: StatBlock;
  maxValue?: number;
}

export function MiniStatBars({ baseStats, trainedStats, maxValue = 80 }: MiniStatBarsProps) {
  const [hovered, setHovered] = useState<StatType | null>(null);
  const hoveredStat = hovered
    ? STATS.find(s => s.key === hovered)
    : null;
  const hoveredValue = hovered
    ? Math.round(Math.min(baseStats[hovered] + trainedStats[hovered], maxValue))
    : null;

  return (
    <div className="flex items-center gap-2">
      {/* Bars */}
      <div className="flex items-end gap-[7px]" style={{ height: 38 }}>
        {STATS.map(({ key, color }) => {
          const total = Math.min(baseStats[key] + trainedStats[key], maxValue);
          const pct = (total / maxValue) * 100;
          return (
            <div
              key={key}
              className={cn(
                'w-3 rounded-t-sm cursor-default transition-opacity',
                color,
                hovered && hovered !== key ? 'opacity-30' : 'opacity-90',
              )}
              style={{ height: `${Math.max(pct, 8)}%` }}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>

      {/* Hover label — shows stat name + value for whichever bar is hovered */}
      {hoveredStat && (
        <div className="font-mono text-[11px] leading-tight whitespace-nowrap">
          <span className="text-muted-foreground">{hoveredStat.label} </span>
          <span className="text-foreground font-semibold">{hoveredValue}</span>
        </div>
      )}
    </div>
  );
}

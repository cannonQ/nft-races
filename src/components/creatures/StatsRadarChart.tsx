import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { StatBlock } from '@/types/game';

interface StatsRadarChartProps {
  baseStats: StatBlock;
  trainedStats: StatBlock;
}

const statLabels: Record<keyof StatBlock, string> = {
  speed: 'SPD',
  stamina: 'STA',
  accel: 'ACC',
  agility: 'AGI',
  heart: 'HRT',
  focus: 'FOC',
};

export function StatsRadarChart({ baseStats, trainedStats }: StatsRadarChartProps) {
  const data = Object.keys(baseStats).map((key) => {
    const statKey = key as keyof StatBlock;
    return {
      stat: statLabels[statKey],
      base: baseStats[statKey],
      total: baseStats[statKey] + trainedStats[statKey],
    };
  });

  return (
    <div className="w-full h-[280px] md:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid 
            stroke="hsl(var(--border))" 
            strokeOpacity={0.5}
          />
          <PolarAngleAxis 
            dataKey="stat" 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
            tickCount={5}
          />
          {/* Base stats layer */}
          <Radar
            name="Base"
            dataKey="base"
            stroke="hsl(var(--muted-foreground))"
            fill="hsl(var(--muted))"
            fillOpacity={0.4}
            strokeWidth={2}
          />
          {/* Total stats layer (base + trained) */}
          <Radar
            name="Total"
            dataKey="total"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

import { Zap, Route, Wind, Timer, Dumbbell, Brain, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrainingLogEntry, StatType } from '@/types/game';

interface TrainingLogProps {
  logs: TrainingLogEntry[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Route,
  Wind,
  Timer,
  Dumbbell,
  Brain,
};

const statColors: Record<StatType, string> = {
  speed: 'text-primary',
  stamina: 'text-secondary',
  accel: 'text-race-sprint',
  agility: 'text-race-technical',
  heart: 'text-race-hazard',
  focus: 'text-rarity-epic',
};

export function TrainingLog({ logs }: TrainingLogProps) {
  if (logs.length === 0) {
    return (
      <div className="cyber-card rounded-xl p-6 text-center">
        <p className="text-muted-foreground text-sm">No training sessions yet</p>
      </div>
    );
  }

  return (
    <div className="cyber-card rounded-xl overflow-hidden">
      <div className="divide-y divide-border/30">
        {logs.map((entry) => {
          const IconComponent = iconMap[entry.activityIcon] || Zap;
          const dateObj = new Date(entry.createdAt);
          const formattedDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          const formattedTime = dateObj.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });

          // Extract primary stat gain from statChanges
          const primaryGain = entry.statChanges?.[entry.primaryStat] ?? 0;
          // Sum all stat changes for a total
          const allGains = Object.entries(entry.statChanges ?? {})
            .filter(([, v]) => (v ?? 0) > 0);

          return (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3"
            >
              <div className="flex items-center gap-3">
                {/* Activity Icon */}
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <IconComponent className="w-4 h-4 text-primary" />
                </div>

                {/* Activity Info */}
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">
                      {entry.activityName}
                    </p>
                    {entry.wasBoosted && (
                      <Flame className="w-3 h-3 text-orange-400" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formattedDate} • {formattedTime}
                  </p>
                </div>
              </div>

              {/* Gains */}
              <div className="text-right space-y-0.5">
                {allGains.map(([stat, value]) => (
                  <div key={stat} className="flex items-center justify-end gap-1">
                    <span className={cn(
                      'font-mono text-sm font-semibold',
                      statColors[stat as StatType] ?? 'text-primary'
                    )}>
                      +{Math.round((value ?? 0) * 100) / 100}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {stat}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { Zap, Route, Wind, Timer, Dumbbell, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatType } from '@/types/game';

interface TrainingLogEntry {
  id: string;
  activityName: string;
  activityIcon: string;
  primaryStat: StatType;
  gain: number;
  date: string; // ISO string
}

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
          const dateObj = new Date(entry.date);
          const formattedDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          const formattedTime = dateObj.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });

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
                  <p className="text-sm font-medium text-foreground">
                    {entry.activityName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formattedDate} • {formattedTime}
                  </p>
                </div>
              </div>

              {/* Gain */}
              <div className="text-right">
                <span className={cn(
                  'font-mono text-sm font-semibold',
                  statColors[entry.primaryStat]
                )}>
                  +{entry.gain}
                </span>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {entry.primaryStat}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

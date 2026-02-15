import { Zap, Route, Wind, Timer, Dumbbell, Brain, Leaf, Flame, LucideIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { TrainingActivity, StatType } from '@/types/game';
import { cn } from '@/lib/utils';

interface ActivityCardProps {
  activity: TrainingActivity;
  disabled?: boolean;
  onSelect: (activity: TrainingActivity) => void;
  hasBoostsAvailable?: boolean;
}

const iconMap: Record<string, LucideIcon> = {
  Zap,
  Route,
  Wind,
  Timer,
  Dumbbell,
  Brain,
  Leaf,
};

const statColors: Record<StatType, string> = {
  speed: 'text-stat-speed',
  stamina: 'text-stat-stamina',
  accel: 'text-stat-acceleration',
  agility: 'text-stat-agility',
  heart: 'text-stat-heart',
  focus: 'text-stat-focus',
};

const statLabels: Record<StatType, string> = {
  speed: 'Speed',
  stamina: 'Stamina',
  accel: 'Accel',
  agility: 'Agility',
  heart: 'Heart',
  focus: 'Focus',
};

export function ActivityCard({ activity, disabled, onSelect, hasBoostsAvailable = false }: ActivityCardProps) {
  const Icon = iconMap[activity.icon] || Dumbbell;

  return (
    <button
      onClick={() => onSelect(activity)}
      disabled={disabled}
      className={cn(
        'cyber-card rounded-xl p-4 text-left transition-all duration-300 group',
        'hover:scale-[1.02] active:scale-[0.98]',
        disabled && 'opacity-50 pointer-events-none grayscale',
        hasBoostsAvailable && 'ring-1 ring-primary/40'
      )}
    >
      {/* Icon & Name */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          'p-2.5 rounded-lg transition-all duration-300',
          'bg-primary/10 group-hover:bg-primary/20',
          disabled && 'bg-muted'
        )}>
          <Icon className={cn(
            'w-5 h-5 transition-all duration-300',
            disabled ? 'text-muted-foreground' : 'text-primary group-hover:drop-shadow-[0_0_8px_hsl(var(--primary))]'
          )} />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-sm font-semibold text-foreground">
            {activity.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {activity.description}
          </p>
        </div>
      </div>

      {/* Stat Gains or Recovery Tag */}
      {activity.primaryGain === 0 && activity.fatigueCost < 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-accent/10 text-accent">
            <Leaf className="w-3 h-3" />
            <span>Recovery</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-3">
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-mono',
            'bg-primary/10',
            statColors[activity.primaryStat]
          )}>
            <span>+{activity.primaryGain}</span>
            <span className="opacity-70">{statLabels[activity.primaryStat]}</span>
            {hasBoostsAvailable && (
              <Flame className="w-3 h-3 text-primary" />
            )}
          </div>
          {activity.secondaryStat && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-mono',
              'bg-muted',
              statColors[activity.secondaryStat]
            )}>
              <span>+{activity.secondaryGain}</span>
              <span className="opacity-70">{statLabels[activity.secondaryStat]}</span>
            </div>
          )}
        </div>
      )}

      {/* Fatigue & Sharpness Cost */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          {activity.fatigueCost < 0 ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-muted-foreground">
                Fatigue: <span className="font-mono text-accent">{activity.fatigueCost}%</span>
              </span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
              <span className="text-muted-foreground">
                Fatigue: <span className="font-mono text-destructive">+{activity.fatigueCost}%</span>
              </span>
            </>
          )}
        </div>
        {activity.sharpnessDelta !== 0 && (
          <div className="flex items-center gap-1">
            {activity.sharpnessDelta > 0 ? (
              <ArrowUp className="w-3 h-3 text-accent" />
            ) : (
              <ArrowDown className="w-3 h-3 text-destructive" />
            )}
            <span className={cn(
              'font-mono',
              activity.sharpnessDelta > 0 ? 'text-accent' : 'text-destructive'
            )}>
              {activity.sharpnessDelta > 0 ? '+' : ''}{activity.sharpnessDelta}
            </span>
            <span className="text-muted-foreground">Sharp</span>
          </div>
        )}
      </div>
    </button>
  );
}

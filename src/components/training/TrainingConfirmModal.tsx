import { AlertTriangle, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreatureWithStats, TrainingActivity, StatType } from '@/types/game';
import { cn } from '@/lib/utils';

interface TrainingConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creature: CreatureWithStats;
  activity: TrainingActivity | null;
  onConfirm: () => void;
}

const statLabels: Record<StatType, string> = {
  speed: 'Speed',
  stamina: 'Stamina',
  accel: 'Acceleration',
  agility: 'Agility',
  heart: 'Heart',
  focus: 'Focus',
};

const statColors: Record<StatType, string> = {
  speed: 'text-stat-speed',
  stamina: 'text-stat-stamina',
  accel: 'text-stat-acceleration',
  agility: 'text-stat-agility',
  heart: 'text-stat-heart',
  focus: 'text-stat-focus',
};

export function TrainingConfirmModal({
  open,
  onOpenChange,
  creature,
  activity,
  onConfirm,
}: TrainingConfirmModalProps) {
  if (!activity) return null;

  const newFatigue = Math.min(100, creature.fatigue + activity.fatigueCost);
  const isHighFatigue = newFatigue >= 80;

  const currentPrimary = creature.baseStats[activity.primaryStat] + creature.trainedStats[activity.primaryStat];
  const newPrimary = currentPrimary + activity.primaryGain;

  const currentSecondary = activity.secondaryStat 
    ? creature.baseStats[activity.secondaryStat] + creature.trainedStats[activity.secondaryStat]
    : 0;
  const newSecondary = currentSecondary + activity.secondaryGain;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cyber-card border-primary/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            Confirm Training
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Train <span className="text-primary font-semibold">{creature.name}</span> with{' '}
            <span className="text-foreground font-semibold">{activity.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stat Changes */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Projected Gains
            </h4>
            
            <div className="cyber-card rounded-lg p-3 space-y-2">
              {/* Primary Stat */}
              <div className="flex items-center justify-between">
                <span className={cn('font-mono text-sm', statColors[activity.primaryStat])}>
                  {statLabels[activity.primaryStat]}
                </span>
                <div className="flex items-center gap-2 font-mono text-sm">
                  <span className="text-muted-foreground">{currentPrimary}</span>
                  <TrendingUp className="w-3 h-3 text-accent" />
                  <span className={statColors[activity.primaryStat]}>{newPrimary}</span>
                  <span className="text-accent text-xs">(+{activity.primaryGain})</span>
                </div>
              </div>

              {/* Secondary Stat */}
              {activity.secondaryStat && (
                <div className="flex items-center justify-between">
                  <span className={cn('font-mono text-sm', statColors[activity.secondaryStat])}>
                    {statLabels[activity.secondaryStat]}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="text-muted-foreground">{currentSecondary}</span>
                    <TrendingUp className="w-3 h-3 text-accent" />
                    <span className={statColors[activity.secondaryStat]}>{newSecondary}</span>
                    <span className="text-accent text-xs">(+{activity.secondaryGain})</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fatigue Change */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Fatigue Impact
            </h4>
            
            <div className={cn(
              'cyber-card rounded-lg p-3',
              isHighFatigue && 'border-destructive/50'
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-muted-foreground">Fatigue Level</span>
                <div className="flex items-center gap-2 font-mono text-sm">
                  <span className="text-muted-foreground">{creature.fatigue}%</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={cn(
                    isHighFatigue ? 'text-destructive' : 'text-foreground'
                  )}>
                    {newFatigue}%
                  </span>
                </div>
              </div>
              
              {/* Fatigue bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    newFatigue <= 30 ? 'bg-stat-stamina' :
                    newFatigue <= 60 ? 'bg-stat-acceleration' :
                    'bg-destructive'
                  )}
                  style={{ width: `${newFatigue}%` }}
                />
              </div>
            </div>

            {isHighFatigue && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  High fatigue warning! Your creature may perform poorly in races and risk injury.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-muted-foreground/30"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={cn(
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'glow-cyan'
            )}
          >
            Start Training
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

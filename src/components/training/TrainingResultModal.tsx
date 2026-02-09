import { useState, useEffect } from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreatureWithStats, TrainingActivity, TrainResponse, StatType } from '@/types/game';
import { cn } from '@/lib/utils';

interface TrainingResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creature: CreatureWithStats;
  activity: TrainingActivity | null;
  boostMultiplier?: number;
  trainResult?: TrainResponse | null;
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

interface AnimatedNumberProps {
  from: number;
  to: number;
  className?: string;
}

function AnimatedNumber({ from, to, className }: AnimatedNumberProps) {
  const [current, setCurrent] = useState(from);

  useEffect(() => {
    const duration = 1000;
    const steps = 20;
    const increment = (to - from) / steps;
    const stepDuration = duration / steps;
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step >= steps) {
        setCurrent(to);
        clearInterval(timer);
      } else {
        setCurrent(Math.round(from + increment * step));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [from, to]);

  return <span className={className}>{current}</span>;
}

export function TrainingResultModal({
  open,
  onOpenChange,
  creature,
  activity,
  boostMultiplier = 0,
  trainResult,
}: TrainingResultModalProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShowAnimation(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowAnimation(false);
    }
  }, [open]);

  if (!activity) return null;

  // Use real API data when available, fall back to estimated gains
  const hasBoost = trainResult ? trainResult.boostUsed : boostMultiplier > 0;
  const primaryGain = trainResult?.statChanges[activity.primaryStat] ?? (
    hasBoost ? Math.round(activity.primaryGain * (1 + boostMultiplier)) : activity.primaryGain
  );
  const secondaryGain = activity.secondaryStat
    ? (trainResult?.statChanges[activity.secondaryStat] ?? (
        hasBoost ? Math.round(activity.secondaryGain * (1 + boostMultiplier)) : activity.secondaryGain
      ))
    : 0;

  const oldPrimary = creature.baseStats[activity.primaryStat] + creature.trainedStats[activity.primaryStat];
  const newPrimary = trainResult
    ? (trainResult.newStats[activity.primaryStat] + creature.baseStats[activity.primaryStat])
    : oldPrimary + primaryGain;

  const oldSecondary = activity.secondaryStat
    ? creature.baseStats[activity.secondaryStat] + creature.trainedStats[activity.secondaryStat]
    : 0;
  const newSecondary = activity.secondaryStat && trainResult
    ? (trainResult.newStats[activity.secondaryStat] + creature.baseStats[activity.secondaryStat])
    : oldSecondary + secondaryGain;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cyber-card border-accent/30 max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center',
              'bg-accent/20 glow-green',
              showAnimation && 'animate-scale-in'
            )}>
              <CheckCircle className="w-8 h-8 text-accent" />
            </div>
          </div>
          <DialogTitle className="font-display text-2xl text-foreground text-center">
            Training Complete!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Activity completed */}
          <div className="text-center">
            <p className="text-muted-foreground">
              <span className="text-primary font-semibold">{creature.name}</span> completed{' '}
              <span className="text-foreground font-semibold">{activity.name}</span>
            </p>
            {hasBoost && (
              <p className="text-primary text-sm mt-1 font-semibold">
                🔥 +{Math.round(boostMultiplier * 100)}% Boost Applied!
              </p>
            )}
          </div>

          {/* Animated stat gains */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
              Stats Improved
            </h4>

            <div className="cyber-card rounded-lg p-4 space-y-4">
              {/* Primary Stat */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className={cn('w-4 h-4', statColors[activity.primaryStat])} />
                  <span className={cn('font-display text-sm', statColors[activity.primaryStat])}>
                    {statLabels[activity.primaryStat]}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl text-muted-foreground">{oldPrimary}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={cn('font-mono text-3xl font-bold', statColors[activity.primaryStat])}>
                    {showAnimation ? (
                      <AnimatedNumber from={oldPrimary} to={newPrimary} />
                    ) : (
                      oldPrimary
                    )}
                  </span>
                    <span className="text-accent font-mono text-lg">+{Math.round(primaryGain * 100) / 100}</span>
                  </div>
                
                {/* Animated bar */}
                <div className="mt-3 h-3 rounded-full bg-muted overflow-hidden">
                  <div 
                    className={cn(
                      'h-full rounded-full transition-all duration-1000 ease-out',
                      activity.primaryStat === 'speed' && 'bg-stat-speed',
                      activity.primaryStat === 'stamina' && 'bg-stat-stamina',
                      activity.primaryStat === 'accel' && 'bg-stat-acceleration',
                      activity.primaryStat === 'agility' && 'bg-stat-agility',
                      activity.primaryStat === 'heart' && 'bg-stat-heart',
                      activity.primaryStat === 'focus' && 'bg-stat-focus',
                    )}
                    style={{ 
                      width: showAnimation ? `${newPrimary}%` : `${oldPrimary}%`,
                    }}
                  />
                </div>
              </div>

              {/* Secondary Stat */}
              {activity.secondaryStat && (
                <div className="text-center pt-3 border-t border-border">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Sparkles className={cn('w-3 h-3', statColors[activity.secondaryStat])} />
                    <span className={cn('font-display text-xs', statColors[activity.secondaryStat])}>
                      {statLabels[activity.secondaryStat]}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-lg text-muted-foreground">{oldSecondary}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={cn('font-mono text-xl font-bold', statColors[activity.secondaryStat])}>
                      {showAnimation ? (
                        <AnimatedNumber from={oldSecondary} to={newSecondary} />
                      ) : (
                        oldSecondary
                      )}
                    </span>
                    <span className="text-accent font-mono text-sm">+{Math.round(secondaryGain * 100) / 100}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {trainResult && (
          <div className="text-center text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{trainResult.actionsRemaining}</span> actions remaining today
          </div>
        )}

        <div className="flex justify-center">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 glow-green px-8"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

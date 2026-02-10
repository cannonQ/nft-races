import { Battery, Sparkles } from 'lucide-react';
import { cn, fmtStat } from '@/lib/utils';

interface ConditionGaugesProps {
  fatigue: number;
  sharpness: number;
}

export function ConditionGauges({ fatigue, sharpness }: ConditionGaugesProps) {
  const getFatigueColor = (value: number) => {
    if (value >= 70) return 'bg-destructive';
    if (value >= 40) return 'bg-race-sprint';
    return 'bg-secondary';
  };

  const getSharpnessColor = (value: number) => {
    if (value >= 70) return 'bg-secondary';
    if (value >= 40) return 'bg-race-sprint';
    return 'bg-destructive';
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Fatigue */}
      <div className="cyber-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Battery className={cn(
            'w-4 h-4',
            fatigue >= 70 ? 'text-destructive' : fatigue >= 40 ? 'text-race-sprint' : 'text-secondary'
          )} />
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Fatigue
          </span>
        </div>
        <div className="flex items-end justify-between mb-2">
          <span className="font-mono text-2xl font-bold text-foreground">{fmtStat(fatigue)}%</span>
          <span className={cn(
            'text-xs font-semibold',
            fatigue >= 70 ? 'text-destructive' : fatigue >= 40 ? 'text-race-sprint' : 'text-secondary'
          )}>
            {fatigue >= 70 ? 'Exhausted' : fatigue >= 40 ? 'Tired' : 'Fresh'}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn('h-full rounded-full transition-all duration-500', getFatigueColor(fatigue))}
            style={{ width: `${fatigue}%` }}
          />
        </div>
      </div>

      {/* Sharpness */}
      <div className="cyber-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className={cn(
            'w-4 h-4',
            sharpness >= 70 ? 'text-secondary' : sharpness >= 40 ? 'text-race-sprint' : 'text-destructive'
          )} />
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            Sharpness
          </span>
        </div>
        <div className="flex items-end justify-between mb-2">
          <span className="font-mono text-2xl font-bold text-foreground">{fmtStat(sharpness)}%</span>
          <span className={cn(
            'text-xs font-semibold',
            sharpness >= 70 ? 'text-secondary' : sharpness >= 40 ? 'text-race-sprint' : 'text-destructive'
          )}>
            {sharpness >= 70 ? 'Peak' : sharpness >= 40 ? 'Ready' : 'Dull'}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn('h-full rounded-full transition-all duration-500', getSharpnessColor(sharpness))}
            style={{ width: `${sharpness}%` }}
          />
        </div>
      </div>
    </div>
  );
}

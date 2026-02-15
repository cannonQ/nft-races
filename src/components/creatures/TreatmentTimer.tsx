import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreatmentTimerProps {
  endsAt: string;
  treatmentName?: string;
  className?: string;
  compact?: boolean;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Complete';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function TreatmentTimer({ endsAt, treatmentName, className, compact }: TreatmentTimerProps) {
  const [remaining, setRemaining] = useState(() => {
    return Math.max(0, new Date(endsAt).getTime() - Date.now());
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemaining(ms);
      if (ms <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  const totalDuration = new Date(endsAt).getTime() - Date.now() + remaining;
  const progress = totalDuration > 0 ? Math.max(0, 1 - remaining / totalDuration) : 1;
  const isComplete = remaining <= 0;

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-1.5 text-xs',
        isComplete ? 'text-accent' : 'text-orange-400',
        className,
      )}>
        <Clock className="w-3 h-3" />
        <span className="font-mono">{formatTimeRemaining(remaining)}</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Clock className={cn('w-3.5 h-3.5', isComplete ? 'text-accent' : 'text-orange-400')} />
          <span className="text-muted-foreground">
            {treatmentName ?? 'Treatment'}
          </span>
        </div>
        <span className={cn(
          'font-mono font-semibold',
          isComplete ? 'text-accent' : 'text-orange-400',
        )}>
          {formatTimeRemaining(remaining)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000 ease-linear',
            isComplete ? 'bg-accent' : 'bg-orange-400',
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

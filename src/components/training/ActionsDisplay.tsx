import { cn } from '@/lib/utils';

interface ActionsDisplayProps {
  actionsRemaining: number;
  maxActionsToday: number;
  bonusActions: number;
  className?: string;
}

export function ActionsDisplay({ actionsRemaining, maxActionsToday, bonusActions, className }: ActionsDisplayProps) {
  const hasBonus = bonusActions > 0;
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">Actions:</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: maxActionsToday }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-3 h-3 rounded-full transition-all',
              i < actionsRemaining
                ? hasBonus && i >= (maxActionsToday - bonusActions)
                  ? 'bg-race-sprint shadow-[0_0_8px_hsl(var(--race-sprint)/0.6)]' // Bonus action dot
                  : 'bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]'
                : 'bg-muted'
            )}
          />
        ))}
      </div>
      <span className={cn(
        'text-sm font-mono',
        actionsRemaining > 0 ? 'text-foreground' : 'text-muted-foreground'
      )}>
        {actionsRemaining}/{maxActionsToday}
        {hasBonus && (
          <span className="text-race-sprint ml-1 text-xs">(+{bonusActions} bonus!)</span>
        )}
      </span>
    </div>
  );
}

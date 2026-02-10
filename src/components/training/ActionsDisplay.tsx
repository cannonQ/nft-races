import { cn } from '@/lib/utils';

interface ActionsDisplayProps {
  actionsRemaining: number;
  maxActionsToday: number;
  bonusActions: number;
  className?: string;
}

export function ActionsDisplay({ actionsRemaining, maxActionsToday, bonusActions, className }: ActionsDisplayProps) {
  const hasBonus = bonusActions > 0;
  const BASE_ACTIONS = 2;

  // Dots: [bonus remaining...] [regular (2)...]
  // Bonus dots come first since they're consumed first.
  // Total dots = bonusActions + BASE_ACTIONS = maxActionsToday
  const regularRemaining = Math.max(0, actionsRemaining - bonusActions);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">Actions:</span>
      <div className="flex items-center gap-1">
        {/* Bonus action dots (consumed first) */}
        {Array.from({ length: bonusActions }).map((_, i) => (
          <div
            key={`bonus-${i}`}
            className="w-3 h-3 rounded-full bg-race-sprint shadow-[0_0_8px_hsl(var(--race-sprint)/0.6)]"
          />
        ))}
        {/* Regular daily action dots */}
        {Array.from({ length: BASE_ACTIONS }).map((_, i) => (
          <div
            key={`regular-${i}`}
            className={cn(
              'w-3 h-3 rounded-full transition-all',
              i < regularRemaining
                ? 'bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]'
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

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/utils';

interface CooldownTimerProps {
  endsAt: string | null;
}

export function CooldownTimer({ endsAt }: CooldownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isReady, setIsReady] = useState(!endsAt || new Date(endsAt) <= new Date());

  useEffect(() => {
    if (!endsAt) {
      setIsReady(true);
      setTimeLeft('Ready!');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const endDate = new Date(endsAt);
      if (endDate <= now) {
        setIsReady(true);
        setTimeLeft('Ready!');
      } else {
        setIsReady(false);
        setTimeLeft(formatCountdown(endsAt));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000 * 60); // Update every minute

    return () => clearInterval(interval);
  }, [endsAt]);

  if (isReady) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 pulse-ready">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="font-mono text-xs text-accent font-semibold">Ready!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
      <span className="font-mono text-xs text-muted-foreground">
        Next action: {timeLeft}
      </span>
    </div>
  );
}

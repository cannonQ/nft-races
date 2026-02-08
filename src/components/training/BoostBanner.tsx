import { Flame, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoostBannerProps {
  boostMultiplier: number;
  className?: string;
}

export function BoostBanner({ boostMultiplier, className }: BoostBannerProps) {
  if (boostMultiplier === 0) return null;

  const boostPercent = Math.round(boostMultiplier * 100);

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl p-4 border',
      'bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10',
      'border-primary/30',
      className
    )}>
      {/* Animated glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-pulse" />
      
      <div className="relative flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Flame className="w-5 h-5 text-primary animate-pulse" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-primary">
              Race Reward Active
            </span>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="text-primary font-semibold">+{boostPercent}% gains</span> on your next action — choose wisely!
          </p>
        </div>
      </div>
    </div>
  );
}

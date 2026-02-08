import { Trophy, Clock, Sparkles } from 'lucide-react';
import { useCurrentSeason } from '@/api';
import { formatDaysRemaining } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';

export function SeasonBanner() {
  const isMobile = useIsMobile();
  const { data: season, loading } = useCurrentSeason();

  if (loading) {
    return (
      <div className="cyber-card rounded-lg p-4">
        <Skeleton className="h-6 w-48" />
      </div>
    );
  }

  if (!season) return null;

  const daysRemaining = formatDaysRemaining(season.endDate);

  if (isMobile) {
    return (
      <div className="cyber-card rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-display text-sm text-primary">{season.name}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{daysRemaining}d left</span>
            <span className="font-mono text-accent">${season.prizePool.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-card rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-display text-lg text-primary">{season.name}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-secondary">{season.modifier.description}</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">{daysRemaining} days remaining</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent" />
            <span className="font-mono text-accent font-semibold">
              ${season.prizePool.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Prize Pool</span>
          </div>
        </div>
      </div>
    </div>
  );
}

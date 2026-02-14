import { Trophy, Clock, Sparkles } from 'lucide-react';
import { useSeasons } from '@/api';
import { formatDaysRemaining } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';

export function SeasonBanner() {
  const isMobile = useIsMobile();
  const { data: seasons, loading } = useSeasons();

  if (loading) {
    return (
      <div className="cyber-card rounded-lg p-4">
        <Skeleton className="h-6 w-48" />
      </div>
    );
  }

  if (!seasons || seasons.length === 0) return null;

  const totalPrizePool = seasons.reduce((sum, s) => sum + (s.prizePool ?? 0), 0);
  // Use shortest remaining time across all seasons
  const soonestEnd = seasons.reduce((min, s) => {
    const d = formatDaysRemaining(s.endDate);
    return d < min ? d : min;
  }, Infinity);
  const daysRemaining = soonestEnd === Infinity ? formatDaysRemaining(seasons[0].endDate) : soonestEnd;

  // If single season, show its name; if multiple, show first season name or generic
  const displayName = seasons.length === 1
    ? seasons[0].name
    : seasons.map(s => s.name).join(' + ');
  const modifier = seasons.length === 1 ? seasons[0].modifier : undefined;

  if (isMobile) {
    return (
      <div className="cyber-card rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-display text-sm text-primary">{displayName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{daysRemaining}d left</span>
            <span className="font-mono text-accent">{totalPrizePool.toLocaleString()} ERG</span>
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
            <span className="font-display text-lg text-primary">{displayName}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          {modifier?.description && (
            <span className="text-sm text-secondary">{modifier.description}</span>
          )}
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
              {totalPrizePool.toLocaleString()} ERG
            </span>
            <span className="text-xs text-muted-foreground">Prize Pool</span>
          </div>
        </div>
      </div>
    </div>
  );
}

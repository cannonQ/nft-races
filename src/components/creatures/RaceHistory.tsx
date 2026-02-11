import { Link } from 'react-router-dom';
import { Trophy, Medal, Award, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RaceHistoryEntry {
  raceId: string;
  raceName: string;
  raceType?: string;
  date: string; // ISO string
  position: number;
  payout: number;
}

interface RaceHistoryProps {
  history: RaceHistoryEntry[];
}

export function RaceHistory({ history }: RaceHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="cyber-card rounded-xl p-6 text-center">
        <p className="text-muted-foreground text-sm">No race history yet</p>
      </div>
    );
  }

  return (
    <div className="cyber-card rounded-xl overflow-hidden">
      <div className="divide-y divide-border/30">
        {history.map((entry, index) => {
          const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

          return (
            <Link
              key={`${entry.raceId}-${index}`}
              to={`/races/${entry.raceId}/results`}
              className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                {/* Position Icon */}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  entry.position === 1 && 'bg-race-sprint/20',
                  entry.position === 2 && 'bg-muted',
                  entry.position === 3 && 'bg-race-hazard/20',
                  entry.position > 3 && 'bg-muted/50'
                )}>
                  {entry.position === 1 && <Trophy className="w-4 h-4 text-race-sprint" />}
                  {entry.position === 2 && <Medal className="w-4 h-4 text-muted-foreground" />}
                  {entry.position === 3 && <Award className="w-4 h-4 text-race-hazard" />}
                  {entry.position > 3 && (
                    <span className="text-xs font-mono text-muted-foreground">#{entry.position}</span>
                  )}
                </div>

                {/* Race Info */}
                <div>
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {entry.raceName || 'Race'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {entry.raceType && (
                      <span className="uppercase font-semibold tracking-wider">{entry.raceType}</span>
                    )}
                    <span>{formattedDate}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={cn(
                  'font-mono text-sm font-semibold',
                  entry.payout > 0 ? 'text-secondary' : 'text-muted-foreground'
                )}>
                  {entry.payout > 0 ? `+${entry.payout.toLocaleString()}` : '-'}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

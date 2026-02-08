import { Link } from 'react-router-dom';
import { Trophy, Calendar } from 'lucide-react';
import { PastRace, RaceType } from '@/types/game';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface PastRaceItemProps {
  race: PastRace;
}

export function PastRaceItem({ race }: PastRaceItemProps) {
  const formattedDate = new Date(race.completedAt).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  });

  return (
    <Link to={`/races/${race.id}/results`}>
      <Card className="cyber-card group hover:border-primary/50 transition-all duration-200 overflow-hidden">
        <CardContent className="p-4">
          {/* Position Badge */}
          {race.yourPosition && race.yourPosition <= 3 && (
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center mb-3 mx-auto',
              race.yourPosition === 1 && 'bg-race-sprint/20',
              race.yourPosition === 2 && 'bg-muted',
              race.yourPosition === 3 && 'bg-race-hazard/20'
            )}>
              <Trophy className={cn(
                'w-5 h-5',
                race.yourPosition === 1 && 'text-race-sprint',
                race.yourPosition === 2 && 'text-muted-foreground',
                race.yourPosition === 3 && 'text-race-hazard'
              )} />
            </div>
          )}
          
          {/* Race Name */}
          <h4 className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors text-center truncate">
            {race.name}
          </h4>
          
          {/* Date & Position */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
            {race.yourPosition && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className={cn(
                  'text-xs font-mono font-semibold',
                  race.yourPosition === 1 && 'text-race-sprint',
                  race.yourPosition === 2 && 'text-muted-foreground',
                  race.yourPosition === 3 && 'text-race-hazard',
                  race.yourPosition > 3 && 'text-foreground'
                )}>
                  #{race.yourPosition}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// Mock past races data
export const mockPastRaces: PastRace[] = [
  { id: 'race_past_001', name: 'Neon Thunder Sprint', raceType: 'sprint', completedAt: '2026-02-05T18:00:00Z', yourPosition: 1 },
  { id: 'race_past_002', name: 'Endurance Marathon', raceType: 'distance', completedAt: '2026-02-02T18:00:00Z', yourPosition: 2 },
];

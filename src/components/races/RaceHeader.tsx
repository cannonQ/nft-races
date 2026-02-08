import { Clock, Users, Coins, Trophy } from 'lucide-react';
import { RaceType } from '@/types/game';
import { cn } from '@/lib/utils';

interface RaceInfo {
  id: string;
  name: string;
  raceType: RaceType;
  totalEntrants: number;
  entryFee: number;
  totalPrizePool: number;
  completedAt: string;
}

interface RaceHeaderProps {
  race: RaceInfo;
}

const typeColors: Record<RaceType, { bg: string; text: string }> = {
  sprint: { bg: 'bg-race-sprint/20', text: 'text-race-sprint' },
  distance: { bg: 'bg-race-distance/20', text: 'text-race-distance' },
  technical: { bg: 'bg-race-technical/20', text: 'text-race-technical' },
  mixed: { bg: 'bg-race-mixed/20', text: 'text-race-mixed' },
  hazard: { bg: 'bg-race-hazard/20', text: 'text-race-hazard' },
};

const typeLabels: Record<RaceType, string> = {
  sprint: 'Sprint',
  distance: 'Distance',
  technical: 'Technical',
  mixed: 'Mixed',
  hazard: 'Hazard',
};

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export function RaceHeader({ race }: RaceHeaderProps) {
  const typeStyle = typeColors[race.raceType];

  return (
    <div className="cyber-card rounded-xl p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Title & Type */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              {race.name}
            </h1>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                typeStyle.bg,
                typeStyle.text
              )}
            >
              {typeLabels[race.raceType]}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Completed {formatDate(race.completedAt)}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Entrants</span>
            </div>
            <p className="font-mono text-lg font-semibold text-foreground">
              {race.totalEntrants}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Coins className="w-3.5 h-3.5" />
              <span>Entry Fee</span>
            </div>
            <p className="font-mono text-lg font-semibold text-foreground">
              {race.entryFee}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Trophy className="w-3.5 h-3.5 text-race-sprint" />
              <span>Prize Pool</span>
            </div>
            <p className="font-mono text-lg font-semibold text-race-sprint">
              {race.totalPrizePool.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

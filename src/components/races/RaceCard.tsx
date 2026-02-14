import { useState, useEffect } from 'react';
import { Clock, Users, Coins } from 'lucide-react';
import { Race, RaceType } from '@/types/game';
import { formatCountdown } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RaceCardProps {
  race: Race;
  onEnter: (race: Race) => void;
  onViewDetails: (race: Race) => void;
  onExpired?: (race: Race) => void;
}

const typeColors: Record<RaceType, { bg: string; text: string; border: string }> = {
  sprint: { bg: 'bg-race-sprint/20', text: 'text-race-sprint', border: 'border-race-sprint/50' },
  distance: { bg: 'bg-race-distance/20', text: 'text-race-distance', border: 'border-race-distance/50' },
  technical: { bg: 'bg-race-technical/20', text: 'text-race-technical', border: 'border-race-technical/50' },
  mixed: { bg: 'bg-race-mixed/20', text: 'text-race-mixed', border: 'border-race-mixed/50' },
  hazard: { bg: 'bg-race-hazard/20', text: 'text-race-hazard', border: 'border-race-hazard/50' },
};

const typeLabels: Record<RaceType, string> = {
  sprint: 'Sprint',
  distance: 'Distance',
  technical: 'Technical',
  mixed: 'Mixed',
  hazard: 'Hazard',
};

export function RaceCard({ race, onEnter, onViewDetails, onExpired }: RaceCardProps) {
  const [timeLeft, setTimeLeft] = useState(formatCountdown(race.entryDeadline));
  const typeStyle = typeColors[race.raceType];
  const isFull = race.entryCount >= race.maxEntries;
  const isOpen = race.status === 'open' && !isFull;
  const entryPercent = (race.entryCount / race.maxEntries) * 100;

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    const tick = () => {
      const newTimeLeft = formatCountdown(race.entryDeadline);
      setTimeLeft(newTimeLeft);

      if (newTimeLeft === 'Ready!') {
        if (onExpired) onExpired(race);
        return; // Stop ticking once expired
      }

      // Speed up polling near deadline: 10s when < 2min, else 60s
      const diff = new Date(race.entryDeadline).getTime() - Date.now();
      const interval = diff <= 120000 ? 10000 : 60000;
      timerId = setTimeout(tick, interval);
    };

    // Initial check — if already expired on mount, notify immediately
    const diff = new Date(race.entryDeadline).getTime() - Date.now();
    if (diff <= 0) {
      if (onExpired) onExpired(race);
    } else {
      const interval = diff <= 120000 ? 10000 : 60000;
      timerId = setTimeout(tick, interval);
    }

    return () => clearTimeout(timerId);
  }, [race.entryDeadline, onExpired, race]);

  return (
    <div 
      className={cn(
        'cyber-card rounded-xl p-4 transition-all duration-300 cursor-pointer',
        isOpen && 'hover:border-primary/50'
      )}
      onClick={() => onViewDetails(race)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {race.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
              typeStyle.bg,
              typeStyle.text
            )}>
              {typeLabels[race.raceType]}
            </span>
            {race.collectionName && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-primary/10 text-primary/80 border border-primary/20">
                {race.collectionName}
              </span>
            )}
          </div>
        </div>
        
        {/* Status badge */}
        {race.status === 'running' ? (
          <span className="px-2 py-1 rounded bg-secondary/20 text-secondary text-xs font-mono animate-pulse">
            In Progress
          </span>
        ) : isFull ? (
          <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-mono">
            Full
          </span>
        ) : null}
      </div>

      {/* Entry Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>Entries</span>
          </div>
          <span className="font-mono">
            <span className={isFull ? 'text-destructive' : 'text-foreground'}>
              {race.entryCount}
            </span>
            <span className="text-muted-foreground">/{race.maxEntries}</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all duration-300',
              isFull ? 'bg-destructive' : 'bg-primary'
            )}
            style={{ width: `${entryPercent}%` }}
          />
        </div>
      </div>

      {/* Info Row */}
      <div className="flex items-center justify-between text-xs mb-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeft}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Coins className="w-3.5 h-3.5 text-race-sprint" />
          <span className="font-mono text-foreground">{race.entryFee}</span>
          <span className="text-muted-foreground">credits</span>
        </div>
      </div>

      {/* Enter Button */}
      <Button
        onClick={(e) => {
          e.stopPropagation();
          onEnter(race);
        }}
        disabled={!isOpen}
        className={cn(
          'w-full',
          isOpen 
            ? `${typeStyle.bg} ${typeStyle.text} border ${typeStyle.border} hover:bg-opacity-30`
            : 'bg-muted text-muted-foreground'
        )}
        variant="outline"
      >
        {race.status === 'running' ? 'View Progress' : isFull ? 'Race Full' : 'Enter Race'}
      </Button>
    </div>
  );
}

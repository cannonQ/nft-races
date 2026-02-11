import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Race, RaceType, Rarity } from '@/types/game';
import { formatCountdown } from '@/lib/utils';
import { Clock, Users, Coins, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRaceResults } from '@/api';
import { useWallet } from '@/context/WalletContext';

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

const rarityStyles: Record<Rarity, string> = {
  common: 'text-muted-foreground',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  masterwork: 'text-rarity-masterwork',
  epic: 'text-rarity-epic',
  relic: 'text-rarity-relic',
  legendary: 'text-rarity-legendary',
  mythic: 'text-rarity-mythic',
  cyberium: 'text-rarity-mythic',
};

interface RaceDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race: Race | null;
  onEnter: (race: Race) => void;
}

export function RaceDetailsModal({ open, onOpenChange, race, onEnter }: RaceDetailsModalProps) {
  const { address } = useWallet();
  const { data: results, loading } = useRaceResults(open && race ? race.id : null);

  if (!race) return null;

  const typeStyle = typeColors[race.raceType];
  const entrants = results?.entries ?? [];
  const isFull = race.entryCount >= race.maxEntries;
  const isOpen = race.status === 'open' && !isFull;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cyber-card border-primary/30 max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="font-display text-xl text-foreground">
                {race.name}
              </DialogTitle>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider mt-2',
                typeStyle.bg,
                typeStyle.text
              )}>
                {typeLabels[race.raceType]}
              </span>
            </div>
            {race.status === 'running' && (
              <span className="px-2 py-1 rounded bg-secondary/20 text-secondary text-xs font-mono animate-pulse">
                In Progress
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Race Info */}
        <div className="grid grid-cols-3 gap-4 py-4 border-b border-border/50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Entries</span>
            </div>
            <p className="font-mono text-foreground">
              {race.entryCount}/{race.maxEntries}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Deadline</span>
            </div>
            <p className="font-mono text-foreground">
              {formatCountdown(race.entryDeadline)}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Coins className="w-3.5 h-3.5 text-race-sprint" />
              <span>Entry</span>
            </div>
            <p className="font-mono text-foreground">
              {race.entryFee} <span className="text-muted-foreground text-xs">credits</span>
            </p>
          </div>
        </div>

        {/* Entrants List */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Competitors ({entrants.length})
            </h3>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : entrants.length > 0 ? (
            <div className="space-y-2">
              {entrants.map((entrant, index) => {
                const isCurrentUser = entrant.ownerAddress === address;
                return (
                  <div
                    key={entrant.creatureId}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-colors',
                      isCurrentUser
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-muted/30 border-border/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-xs font-mono text-muted-foreground">
                        {index + 1}
                      </span>
                      <div>
                        <p className={cn(
                          'font-medium text-sm',
                          isCurrentUser ? 'text-primary' : 'text-foreground'
                        )}>
                          {entrant.creatureName}
                          {isCurrentUser && (
                            <span className="ml-2 text-[10px] text-primary/70">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {entrant.ownerAddress.slice(0, 8)}...{entrant.ownerAddress.slice(-6)}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider',
                      rarityStyles[entrant.rarity]
                    )}>
                      {entrant.rarity}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No entrants yet. Be the first to enter!
            </div>
          )}
        </div>

        {/* Enter Button */}
        {isOpen && (
          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={() => {
                onOpenChange(false);
                onEnter(race);
              }}
              className="w-full bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30"
              variant="outline"
            >
              Enter Race
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

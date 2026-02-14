import { useState } from 'react';
import { AlertTriangle, Check, CheckCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Race, RaceType } from '@/types/game';
import { useCreaturesByWallet } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { RarityBadge, ConditionGauge } from '@/components/creatures/StatBar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RaceEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race: Race | null;
  onConfirm: (creatureIds: string[]) => void;
}

const typeColors: Record<RaceType, string> = {
  sprint: 'text-race-sprint',
  distance: 'text-race-distance',
  technical: 'text-race-technical',
  mixed: 'text-race-mixed',
  hazard: 'text-race-hazard',
};

export function RaceEntryModal({ open, onOpenChange, race, onConfirm }: RaceEntryModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { address } = useWallet();
  const { data: creatures, loading } = useCreaturesByWallet(address);

  if (!race) return null;

  // Filter creatures to only show those matching the race's collection
  const creatureList = (creatures || []).filter(
    c => !race.collectionId || c.collectionId === race.collectionId
  );

  const toggleCreature = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === creatureList.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(creatureList.map(c => c.id)));
    }
  };

  const handleConfirm = () => {
    if (selected.size > 0) {
      onConfirm(Array.from(selected));
      setSelected(new Set());
    }
  };

  const handleClose = () => {
    setSelected(new Set());
    onOpenChange(false);
  };

  const allSelected = creatureList.length > 0 && selected.size === creatureList.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="cyber-card border-primary/30 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            Enter Race
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Select creatures to enter{' '}
            <span className={cn('font-semibold', typeColors[race.raceType])}>{race.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Race Info */}
          <div className="cyber-card rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Entry Fee</span>
              <span className="font-mono text-foreground">
                {selected.size > 1
                  ? `${race.entryFee} x ${selected.size} = ${race.entryFee * selected.size} credits`
                  : `${race.entryFee} credits`
                }
              </span>
            </div>
          </div>

          {/* Select All / Creature Selection */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {creatureList.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="mb-2 text-muted-foreground hover:text-foreground"
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {creatureList.map((creature) => {
                  const isOnCooldown = creature.cooldownEndsAt && new Date(creature.cooldownEndsAt) > new Date();
                  const isHighFatigue = creature.fatigue >= 80;
                  const isSelected = selected.has(creature.id);

                  return (
                    <button
                      key={creature.id}
                      onClick={() => toggleCreature(creature.id)}
                      className={cn(
                        'w-full cyber-card rounded-lg p-3 text-left transition-all duration-200',
                        isSelected && 'border-primary glow-cyan',
                        !isSelected && 'hover:border-primary/50'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/40'
                          )}>
                            {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <h4 className="font-display text-sm font-semibold text-foreground">
                            {creature.name}
                          </h4>
                          <RarityBadge rarity={creature.rarity} />
                        </div>
                        {isOnCooldown && (
                          <span className="text-xs text-muted-foreground font-mono">Training cooldown</span>
                        )}
                      </div>

                      {/* Condition */}
                      <div className="space-y-1">
                        <ConditionGauge type="fatigue" value={creature.fatigue} />
                        <ConditionGauge type="sharpness" value={creature.sharpness} />
                      </div>

                      {/* Warnings */}
                      {isHighFatigue && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive">
                          <AlertTriangle className="w-3 h-3" />
                          <span>High fatigue may affect performance</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {!loading && creatureList.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {race.collectionName
                ? `You don't own any ${race.collectionName} NFTs. This race requires ${race.collectionName} creatures.`
                : 'No creatures available. Register an NFT to enter races.'}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} className="border-muted-foreground/30">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan"
          >
            {selected.size > 1
              ? `Enter ${selected.size} Creatures`
              : `Confirm Entry`
            }
            {selected.size > 0 && ` (${race.entryFee * selected.size} credits)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

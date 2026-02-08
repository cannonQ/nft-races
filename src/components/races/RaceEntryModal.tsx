import { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Race, RaceType, CreatureWithStats } from '@/types/game';
import { useCreaturesByWallet } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { RarityBadge, ConditionGauge } from '@/components/creatures/StatBar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RaceEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race: Race | null;
  onConfirm: (creatureId: string) => void;
}

const typeColors: Record<RaceType, string> = {
  sprint: 'text-race-sprint',
  distance: 'text-race-distance',
  technical: 'text-race-technical',
  mixed: 'text-race-mixed',
  hazard: 'text-race-hazard',
};

export function RaceEntryModal({ open, onOpenChange, race, onConfirm }: RaceEntryModalProps) {
  const [selectedCreature, setSelectedCreature] = useState<string | null>(null);
  const { address } = useWallet();
  const { data: creatures, loading } = useCreaturesByWallet(address);

  if (!race) return null;

  const handleConfirm = () => {
    if (selectedCreature) {
      onConfirm(selectedCreature);
      setSelectedCreature(null);
    }
  };

  const handleClose = () => {
    setSelectedCreature(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="cyber-card border-primary/30 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            Enter Race
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Select a creature to enter{' '}
            <span className={cn('font-semibold', typeColors[race.raceType])}>{race.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Race Info */}
          <div className="cyber-card rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Entry Fee</span>
              <span className="font-mono text-foreground">{race.entryFee} credits</span>
            </div>
          </div>

          {/* Creature Selection */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(creatures || []).map((creature) => {
                const isOnCooldown = creature.cooldownEndsAt && new Date(creature.cooldownEndsAt) > new Date();
                const isHighFatigue = creature.fatigue >= 80;
                const isSelected = selectedCreature === creature.id;
                const isDisabled = isOnCooldown;

                return (
                  <button
                    key={creature.id}
                    onClick={() => !isDisabled && setSelectedCreature(creature.id)}
                    disabled={isDisabled}
                    className={cn(
                      'w-full cyber-card rounded-lg p-3 text-left transition-all duration-200',
                      isSelected && 'border-primary glow-cyan',
                      isDisabled && 'opacity-50 cursor-not-allowed',
                      !isDisabled && !isSelected && 'hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-sm font-semibold text-foreground">
                          {creature.name}
                        </h4>
                        <RarityBadge rarity={creature.rarity} />
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                      {isOnCooldown && (
                        <span className="text-xs text-muted-foreground font-mono">Cooldown</span>
                      )}
                    </div>

                    {/* Condition */}
                    <div className="space-y-1">
                      <ConditionGauge type="fatigue" value={creature.fatigue} />
                      <ConditionGauge type="sharpness" value={creature.sharpness} />
                    </div>

                    {/* Warnings */}
                    {isHighFatigue && !isDisabled && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive">
                        <AlertTriangle className="w-3 h-3" />
                        <span>High fatigue may affect performance</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!loading && (!creatures || creatures.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No creatures available. Register an NFT to enter races.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} className="border-muted-foreground/30">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCreature}
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan"
          >
            Confirm Entry ({race.entryFee} credits)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { AlertTriangle, Check, CheckCheck, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Race, RaceType, CLASS_LABELS, FeeToken, PaymentCurrency, getClassRarities } from '@/types/game';
import { useCreaturesByWallet, useRaceEntries, useGameConfig } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { RarityBadge, ConditionGauge } from '@/components/creatures/StatBar';
import { PaymentSelector } from '@/components/ui/PaymentSelector';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RaceEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race: Race | null;
  onConfirm: (creatureIds: string[], paymentCurrency?: PaymentCurrency) => void;
  requireFees?: boolean;
  walletType?: 'nautilus' | 'ergopay' | null;
  /** When true, show spinner on button and prevent close (TX is being signed) */
  submitting?: boolean;
  feeToken?: FeeToken | null;
}

const typeColors: Record<RaceType, string> = {
  sprint: 'text-race-sprint',
  distance: 'text-race-distance',
  technical: 'text-race-technical',
  mixed: 'text-race-mixed',
  hazard: 'text-race-hazard',
};

/** Round to avoid floating point artifacts like 0.15000000000000002 */
function roundFee(value: number): string {
  return (Math.round(value * 1e8) / 1e8).toString();
}

export function RaceEntryModal({ open, onOpenChange, race, onConfirm, requireFees, walletType, submitting, feeToken }: RaceEntryModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>('erg');

  // Reset selection when modal opens or race changes
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setPaymentCurrency(feeToken ? 'token' : 'erg');
    }
  }, [open, race?.id, feeToken, walletType]);

  const { address } = useWallet();
  const { data: creatures, loading } = useCreaturesByWallet(address);
  // Fetch which of my creatures are already entered in this race
  const { data: enteredCreatureIds } = useRaceEntries(
    open ? race?.id : null,
    address,
  );

  // Per-collection rarity class mapping
  const { data: gameConfig } = useGameConfig(race?.collectionId);
  const classRarities = getClassRarities(gameConfig);
  const allowedRarities = race?.rarityClass ? classRarities[race.rarityClass] : null;
  const creatureList = (creatures || []).filter(c => {
    if (race?.collectionId && c.collectionId !== race.collectionId) return false;
    if (allowedRarities && !allowedRarities.includes(c.rarity.toLowerCase() as any)) return false;
    return true;
  });

  const enteredSet = new Set(enteredCreatureIds ?? []);

  // Only count selectable creatures (not in treatment, not already entered)
  const selectableCreatures = creatureList.filter(c => !c.treatment && !enteredSet.has(c.id));

  // Stable string key so the effect dep doesn't change on every render
  const enteredKey = (enteredCreatureIds ?? []).join(',');

  // Prune selected set when eligibility changes (e.g. enteredCreatureIds loads after Select All)
  useEffect(() => {
    const entered = new Set(enteredCreatureIds ?? []);
    setSelected(prev => {
      const pruned = new Set([...prev].filter(id => {
        const c = creatureList.find(cr => cr.id === id);
        return c && !c.treatment && !entered.has(id);
      }));
      return pruned.size !== prev.size ? pruned : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredKey, creatureList.length]);

  if (!race) return null;

  const toggleCreature = (id: string) => {
    const creature = creatureList.find(c => c.id === id);
    if (!creature || creature.treatment || enteredSet.has(id)) return;

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
    if (selected.size === selectableCreatures.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableCreatures.map(c => c.id)));
    }
  };

  const handleConfirm = () => {
    if (selected.size > 0 && !submitting) {
      onConfirm(Array.from(selected), requireFees ? paymentCurrency : undefined);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setSelected(new Set());
    onOpenChange(false);
  };

  const allSelected = selectableCreatures.length > 0 && selected.size === selectableCreatures.length;
  const totalFee = race.entryFee * selected.size;
  const entryFeeToken = race.entryFeeToken ?? feeToken?.default_race_entry_fee ?? null;
  const totalFeeToken = entryFeeToken ? entryFeeToken * selected.size : null;
  const showTokenOption = requireFees && feeToken && entryFeeToken && (walletType === 'nautilus' || walletType === 'ergopay');
  const unit = requireFees
    ? paymentCurrency === 'token' && feeToken ? feeToken.name : 'ERG'
    : 'credits';

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
          {/* Race Info + Payment Selector */}
          <div className="space-y-2 mb-4">
            {showTokenOption ? (
              <>
                <PaymentSelector
                  feeToken={feeToken!}
                  ergAmount={selected.size > 1
                    ? `${race.entryFee} x ${selected.size} = ${roundFee(totalFee)}`
                    : `${race.entryFee}`
                  }
                  tokenAmount={selected.size > 1
                    ? totalFeeToken!
                    : entryFeeToken!
                  }
                  selected={paymentCurrency}
                  onSelect={setPaymentCurrency}
                />
                {selected.size > 1 && paymentCurrency === 'token' && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    {entryFeeToken} x {selected.size} = {totalFeeToken} {feeToken!.name}
                  </p>
                )}
              </>
            ) : (
              <div className="cyber-card rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Entry Fee</span>
                  <span className="font-mono text-foreground">
                    {selected.size > 1
                      ? `${race.entryFee} x ${selected.size} = ${roundFee(totalFee)} ${unit}`
                      : `${race.entryFee} ${unit}`
                    }
                  </span>
                </div>
              </div>
            )}
            {requireFees && walletType === 'ergopay' && selected.size > 1 && (
              <p className="text-[10px] text-muted-foreground">
                ErgoPay: one payment for all creatures.
              </p>
            )}
          </div>

          {/* Select All / Creature Selection */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {selectableCreatures.length > 1 && (
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
                  const isInTreatment = !!creature.treatment;
                  const isAlreadyEntered = enteredSet.has(creature.id);
                  const isDisabled = isInTreatment || isAlreadyEntered;
                  const isOnCooldown = creature.cooldownEndsAt && new Date(creature.cooldownEndsAt) > new Date();
                  const isHighFatigue = creature.fatigue >= 80;
                  const isSelected = selected.has(creature.id);

                  return (
                    <button
                      key={creature.id}
                      onClick={() => toggleCreature(creature.id)}
                      disabled={isDisabled}
                      className={cn(
                        'w-full cyber-card rounded-lg p-2 sm:p-3 text-left transition-all duration-200',
                        isDisabled && 'opacity-50 cursor-not-allowed',
                        isSelected && !isDisabled && 'border-primary glow-cyan',
                        !isSelected && !isDisabled && 'hover:border-primary/50'
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-y-1 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isDisabled ? (
                            <div className="w-5 h-5 rounded border-2 border-muted-foreground/20 shrink-0" />
                          ) : (
                            <div className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
                              isSelected
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground/40'
                            )}>
                              {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                          )}
                          <h4 className="font-display text-sm font-semibold text-foreground">
                            {creature.name}
                          </h4>
                          <RarityBadge rarity={creature.rarity} />
                        </div>
                        {isAlreadyEntered && (
                          <span className="text-xs text-primary font-semibold">Already entered</span>
                        )}
                        {isInTreatment && !isAlreadyEntered && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                            <Clock className="w-3 h-3" />
                            In treatment
                          </span>
                        )}
                        {!isDisabled && isOnCooldown && (
                          <span className="text-xs text-muted-foreground font-mono">Training cooldown</span>
                        )}
                      </div>

                      {!isDisabled && (
                        <div className="space-y-1">
                          <ConditionGauge type="fatigue" value={creature.fatigue} />
                          <ConditionGauge type="sharpness" value={creature.sharpness} />
                        </div>
                      )}

                      {!isDisabled && isHighFatigue && (
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
              {race.rarityClass
                ? `No eligible creatures. This ${CLASS_LABELS[race.rarityClass]} class race is restricted to ${allowedRarities?.join(', ')} rarities.`
                : race.collectionName
                  ? `You don't own any ${race.collectionName} NFTs. This race requires ${race.collectionName} creatures.`
                  : 'No creatures available. Register an NFT to enter races.'}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={submitting} className="border-muted-foreground/30">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0 || submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                Signing...
              </>
            ) : (
              <>
                {selected.size > 1
                  ? `Enter ${selected.size} Creatures`
                  : `Confirm Entry`
                }
                {selected.size > 0 && (
                  paymentCurrency === 'token' && feeToken && totalFeeToken
                    ? ` (${totalFeeToken} ${feeToken.name})`
                    : ` (${roundFee(totalFee)} ${unit})`
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

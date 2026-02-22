import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, Check, Flame, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PetImage } from '@/components/creatures/PetImage';
import { trainingActivities as defaultActivities } from '@/data/trainingActivities';
import type { CreatureWithStats, TrainingActivity, PaymentCurrency, GameConfig, BatchTrainCreatureInput } from '@/types/game';
import { cn } from '@/lib/utils';

/** Short activity labels for grid columns */
const ACTIVITY_SHORT: Record<string, string> = {
  sprint_drills: 'Sprint',
  distance_runs: 'Dist.',
  agility_course: 'Agility',
  gate_work: 'Gate',
  cross_training: 'Cross',
  mental_prep: 'Mental',
  meditation: 'Meditate',
};

interface BatchCreatureState {
  activity: string | null; // null = inherit default
  boostOverride: string[] | null; // null = auto-apply all
  recoveryRewardIds: string[];
  expanded: boolean;
}

interface BatchTrainingViewProps {
  creatures: CreatureWithStats[];
  gameConfig: GameConfig | null;
  requireFees: boolean;
  feeToken: any;
  trainingFeeNanoerg: number;
  onSubmit: (
    creatures: BatchTrainCreatureInput[],
    paymentCurrency?: PaymentCurrency,
  ) => void;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
}

export function BatchTrainingView({
  creatures,
  gameConfig,
  requireFees,
  feeToken,
  trainingFeeNanoerg,
  onSubmit,
  submitting,
  error,
  onCancel,
}: BatchTrainingViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creatureStates, setCreatureStates] = useState<Map<string, BatchCreatureState>>(new Map());
  const [defaultActivity, setDefaultActivity] = useState<string | null>(null);
  const [autoApplyBoosts, setAutoApplyBoosts] = useState(true);
  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>('erg');

  // Merge server activity config
  const activities = useMemo(() => {
    return defaultActivities.map((a) => {
      const serverDef = (gameConfig as any)?.activities?.[a.id];
      if (!serverDef) return a;
      return {
        ...a,
        primaryGain: serverDef.primary_gain ?? a.primaryGain,
        secondaryGain: serverDef.secondary_gain ?? a.secondaryGain,
        fatigueCost: serverDef.fatigue_cost ?? a.fatigueCost,
        sharpnessDelta: serverDef.sharpness_delta ?? a.sharpnessDelta,
      } as TrainingActivity;
    });
  }, [gameConfig]);

  // Filter eligible creatures
  const eligible = useMemo(() => {
    return creatures.filter((c) => {
      if (c.treatment) return false;
      // Creatures with 0 actions remaining are ineligible
      if (c.actionsRemaining !== undefined && c.actionsRemaining <= 0) return false;
      return true;
    });
  }, [creatures]);

  const ineligible = useMemo(() => {
    return creatures.filter((c) => c.treatment || (c.actionsRemaining !== undefined && c.actionsRemaining <= 0));
  }, [creatures]);

  // Prune selection when creatures change
  useEffect(() => {
    const eligibleIds = new Set(eligible.map((c) => c.id));
    setSelected((prev) => {
      const pruned = new Set([...prev].filter((id) => eligibleIds.has(id)));
      return pruned.size !== prev.size ? pruned : prev;
    });
  }, [eligible]);

  const toggleCreature = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selected.size === eligible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligible.map((c) => c.id)));
    }
  }, [selected.size, eligible]);

  const getCreatureState = useCallback(
    (id: string): BatchCreatureState =>
      creatureStates.get(id) ?? { activity: null, boostOverride: null, recoveryRewardIds: [], expanded: false },
    [creatureStates],
  );

  const updateCreatureState = useCallback((id: string, update: Partial<BatchCreatureState>) => {
    setCreatureStates((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? { activity: null, boostOverride: null, recoveryRewardIds: [], expanded: false };
      next.set(id, { ...existing, ...update });
      return next;
    });
  }, []);

  const getEffectiveActivity = useCallback(
    (id: string): string | null => {
      const state = getCreatureState(id);
      return state.activity ?? defaultActivity;
    },
    [getCreatureState, defaultActivity],
  );

  const setCreatureActivity = useCallback(
    (creatureId: string, activityId: string) => {
      // If setting to same as default, clear override
      if (activityId === defaultActivity) {
        updateCreatureState(creatureId, { activity: null });
      } else {
        updateCreatureState(creatureId, { activity: activityId });
      }
    },
    [defaultActivity, updateCreatureState],
  );

  const toggleExpanded = useCallback(
    (id: string) => {
      const state = getCreatureState(id);
      updateCreatureState(id, { expanded: !state.expanded });
    },
    [getCreatureState, updateCreatureState],
  );

  // When default activity changes, clear overrides that match
  const handleDefaultActivityChange = useCallback(
    (activityId: string) => {
      setDefaultActivity(activityId);
      // Apply to all selected creatures (clear their overrides if matching)
      setCreatureStates((prev) => {
        const next = new Map(prev);
        for (const id of selected) {
          const existing = next.get(id);
          if (existing?.activity === activityId) {
            next.set(id, { ...existing, activity: null });
          }
        }
        return next;
      });
    },
    [selected],
  );

  // Fee calculations
  const trainingFeeToken = feeToken?.training_fee ?? null;
  const totalFeeNanoerg = trainingFeeNanoerg * selected.size;
  const totalFeeErg = totalFeeNanoerg / 1_000_000_000;
  const totalFeeToken = trainingFeeToken ? trainingFeeToken * selected.size : null;

  // Build submission payload
  const handleSubmit = useCallback(() => {
    if (selected.size === 0 || !defaultActivity) return;

    const payload: BatchTrainCreatureInput[] = [];
    for (const id of selected) {
      const state = getCreatureState(id);
      const effectiveActivity = state.activity ?? defaultActivity;
      const creature = creatures.find((c) => c.id === id);
      if (!creature || !effectiveActivity) continue;

      // Boosts: auto-apply all or use override
      let boostRewardIds: string[] | undefined;
      if (autoApplyBoosts && state.boostOverride === null) {
        // Auto-apply: use all unexpired boosts for this creature
        boostRewardIds = creature.boosts?.map((b) => b.id);
      } else if (state.boostOverride) {
        boostRewardIds = state.boostOverride;
      }

      payload.push({
        creatureId: id,
        activity: effectiveActivity,
        boostRewardIds: boostRewardIds?.length ? boostRewardIds : undefined,
        recoveryRewardIds: state.recoveryRewardIds.length ? state.recoveryRewardIds : undefined,
      });
    }

    onSubmit(payload, requireFees ? paymentCurrency : undefined);
  }, [selected, defaultActivity, autoApplyBoosts, creatures, creatureStates, getCreatureState, requireFees, paymentCurrency, onSubmit]);

  const canSubmit = selected.size > 0 && defaultActivity !== null && !submitting;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">Batch Training</h2>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Single Mode
        </Button>
      </div>

      {/* Default Activity Selector */}
      <div className="cyber-card rounded-xl p-4">
        <p className="text-sm text-muted-foreground mb-2">Default Activity (applies to all selected)</p>
        <div className="flex flex-wrap gap-2">
          {activities.map((a) => (
            <button
              key={a.id}
              onClick={() => handleDefaultActivityChange(a.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                defaultActivity === a.id
                  ? 'bg-primary text-primary-foreground shadow-glow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {a.name}
            </button>
          ))}
        </div>

        {/* Auto-apply boosts toggle */}
        <div className="flex items-center gap-2 mt-3">
          <Checkbox
            id="auto-boosts"
            checked={autoApplyBoosts}
            onCheckedChange={(checked) => setAutoApplyBoosts(!!checked)}
          />
          <label htmlFor="auto-boosts" className="text-xs text-muted-foreground cursor-pointer">
            Auto-apply all boosts & recovery packs
          </label>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Grid Matrix */}
      <div className="cyber-card rounded-xl overflow-hidden">
        {/* Select All header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
          <div
            onClick={selectAll}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAll(); } }}
          >
            <Checkbox checked={selected.size > 0 && selected.size === eligible.length} />
            <span>{selected.size === eligible.length ? 'Deselect All' : 'Select All'}</span>
          </div>
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
        </div>

        {/* Scrollable grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-4 py-2 text-muted-foreground font-medium sticky left-0 bg-card z-10 min-w-[160px]">
                  Creature
                </th>
                {activities.map((a) => (
                  <th key={a.id} className="text-center px-2 py-2 text-muted-foreground font-medium whitespace-nowrap">
                    {ACTIVITY_SHORT[a.id] || a.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Eligible creatures */}
              {eligible.map((creature) => {
                const isSelected = selected.has(creature.id);
                const effectiveActivity = getEffectiveActivity(creature.id);
                const state = getCreatureState(creature.id);
                const totalBoost = autoApplyBoosts && state.boostOverride === null
                  ? (creature.boosts || []).reduce((sum, b) => sum + b.multiplier, 0)
                  : (state.boostOverride || []).reduce((sum, id) => {
                      const b = creature.boosts?.find((x) => x.id === id);
                      return sum + (b?.multiplier ?? 0);
                    }, 0);

                return (
                  <tr
                    key={creature.id}
                    className={cn(
                      'border-b border-border/20 transition-colors',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/30',
                    )}
                  >
                    {/* Creature info cell */}
                    <td className="px-4 py-2 sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleCreature(creature.id)}
                        />
                        <PetImage
                          src={creature.imageUrl}
                          fallbackSrc={creature.fallbackImageUrl}
                          alt={creature.name}
                          className="w-8 h-8 rounded-md shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground truncate">{creature.name}</span>
                            {totalBoost > 0 && (
                              <span className="text-[10px] text-amber-400 flex items-center">
                                <Flame className="w-3 h-3" />
                                +{Math.round(totalBoost * 100)}%
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2 text-[10px] text-muted-foreground">
                            <span className="capitalize">{creature.rarity}</span>
                            <span>F:{creature.fatigue}%</span>
                            <span>S:{creature.sharpness}%</span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleExpanded(creature.id)}
                          className="ml-auto p-1 text-muted-foreground hover:text-foreground"
                        >
                          {state.expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>

                    {/* Activity radio cells */}
                    {activities.map((a) => (
                      <td key={a.id} className="text-center px-2 py-2">
                        <button
                          onClick={() => {
                            if (effectiveActivity === a.id) {
                              // Toggle off: clear per-creature override
                              updateCreatureState(creature.id, { activity: null });
                            } else {
                              if (!isSelected) toggleCreature(creature.id);
                              setCreatureActivity(creature.id, a.id);
                            }
                          }}
                          className={cn(
                            'w-5 h-5 rounded-full border-2 inline-flex items-center justify-center transition-all',
                            effectiveActivity === a.id
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/40 hover:border-primary/60',
                          )}
                        >
                          {effectiveActivity === a.id && <Check className="w-3 h-3 text-primary-foreground" />}
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}

              {/* Ineligible creatures (disabled) */}
              {ineligible.map((creature) => (
                <tr key={creature.id} className="border-b border-border/20 opacity-40">
                  <td className="px-4 py-2 sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <Checkbox disabled checked={false} />
                      <PetImage
                        src={creature.imageUrl}
                        fallbackSrc={creature.fallbackImageUrl}
                        alt={creature.name}
                        className="w-8 h-8 rounded-md shrink-0 grayscale"
                      />
                      <div className="min-w-0">
                        <span className="font-medium text-foreground truncate">{creature.name}</span>
                        <div className="text-[10px] text-muted-foreground">
                          {creature.treatment ? 'In treatment' : 'No actions remaining'}
                        </div>
                      </div>
                    </div>
                  </td>
                  {activities.map((a) => (
                    <td key={a.id} className="text-center px-2 py-2">
                      <span className="text-muted-foreground/30">—</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expanded detail rows render below the table for the expanded creature */}
        {eligible
          .filter((c) => selected.has(c.id) && getCreatureState(c.id).expanded)
          .map((creature) => {
            const state = getCreatureState(creature.id);
            const effectiveActivity = getEffectiveActivity(creature.id);
            const actDef = activities.find((a) => a.id === effectiveActivity);

            return (
              <div key={`detail-${creature.id}`} className="px-4 py-3 border-t border-primary/20 bg-primary/5">
                <p className="text-xs font-medium text-foreground mb-2">
                  {creature.name} — {actDef?.name || 'No activity'}
                </p>

                {/* Boosts */}
                {creature.boosts && creature.boosts.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Boosts:</p>
                    <div className="flex flex-wrap gap-1">
                      {creature.boosts.map((b) => {
                        const isActive = autoApplyBoosts && state.boostOverride === null
                          ? true
                          : (state.boostOverride || []).includes(b.id);
                        return (
                          <button
                            key={b.id}
                            onClick={() => {
                              // Toggle individual boost (switches to manual mode)
                              const currentOverride = state.boostOverride ?? creature.boosts!.map((x) => x.id);
                              const next = isActive
                                ? currentOverride.filter((id) => id !== b.id)
                                : [...currentOverride, b.id];
                              updateCreatureState(creature.id, { boostOverride: next });
                            }}
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-md border transition-all',
                              isActive
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : 'bg-muted/30 border-border/30 text-muted-foreground',
                            )}
                          >
                            +{Math.round(b.multiplier * 100)}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recovery packs */}
                {creature.recoveries && creature.recoveries.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Recovery Packs:</p>
                    <div className="flex flex-wrap gap-1">
                      {creature.recoveries.map((r: any) => {
                        const isActive = state.recoveryRewardIds.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            onClick={() => {
                              const next = isActive
                                ? state.recoveryRewardIds.filter((id) => id !== r.id)
                                : [...state.recoveryRewardIds, r.id];
                              updateCreatureState(creature.id, { recoveryRewardIds: next });
                            }}
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-md border transition-all',
                              isActive
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : 'bg-muted/30 border-border/30 text-muted-foreground',
                            )}
                          >
                            -{r.fatigueReduction} Fatigue
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick stat preview */}
                {actDef && (
                  <div className="text-[10px] text-muted-foreground">
                    {actDef.primaryGain > 0 && (
                      <span className="mr-3">
                        +{actDef.primaryGain} {actDef.primaryStat}
                      </span>
                    )}
                    {actDef.secondaryGain > 0 && actDef.secondaryStat && (
                      <span className="mr-3">
                        +{actDef.secondaryGain} {actDef.secondaryStat}
                      </span>
                    )}
                    <span className={actDef.fatigueCost > 0 ? 'text-destructive' : 'text-emerald-400'}>
                      Fatigue: {actDef.fatigueCost > 0 ? '+' : ''}
                      {actDef.fatigueCost}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer: fee summary + submit */}
      <div className="cyber-card rounded-xl p-4 space-y-3">
        {/* Payment selector */}
        {requireFees && feeToken && (
          <div className="flex gap-2">
            <button
              onClick={() => setPaymentCurrency('erg')}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg transition-all',
                paymentCurrency === 'erg'
                  ? 'bg-foreground/10 text-foreground border border-foreground/20'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              ERG
            </button>
            <button
              onClick={() => setPaymentCurrency('token')}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg transition-all',
                paymentCurrency === 'token'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {feeToken.name || 'TOKEN'}
            </button>
          </div>
        )}

        {/* Fee summary */}
        {requireFees && selected.size > 0 && (
          <div className="text-sm text-muted-foreground">
            {paymentCurrency === 'token' && totalFeeToken != null ? (
              <span>
                {selected.size} x {trainingFeeToken} {feeToken?.name} = <strong className="text-foreground">{totalFeeToken} {feeToken?.name}</strong>
              </span>
            ) : (
              <span>
                {selected.size} x {(trainingFeeNanoerg / 1_000_000_000).toFixed(4)} ERG = <strong className="text-foreground">{totalFeeErg.toFixed(4)} ERG</strong>
              </span>
            )}
          </div>
        )}

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
          size="lg"
        >
          {submitting
            ? 'Training...'
            : selected.size > 0
              ? `Train ${selected.size} Creature${selected.size > 1 ? 's' : ''}`
              : 'Select creatures to train'}
        </Button>
      </div>
    </div>
  );
}

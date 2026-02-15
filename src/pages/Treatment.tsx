import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  Zap,
  Snowflake,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useCreature,
  useCreaturesByWallet,
  useGameConfig,
  useCollections,
} from '@/api';
import { useTreatment } from '@/api/useTreatment';
import { useWallet } from '@/context/WalletContext';
import { useCollectionFilter } from '@/hooks/useCollectionFilter';
import { CollectionFilter } from '@/components/ui/CollectionFilter';
import { PetImage } from '@/components/creatures/PetImage';
import { TreatmentTimer } from '@/components/creatures/TreatmentTimer';
import { ErgoPayTxModal } from '@/components/ergopay/ErgoPayTxModal';
import { requestErgoPayTx, type ErgoPayTxRequest } from '@/lib/ergo/ergopay-tx';
import { TreatmentDef, TreatmentStartResponse } from '@/types/game';
import { cn } from '@/lib/utils';

const EXPLORER_TX_URL = 'https://ergexplorer.com/transactions#';

const TIER_META: Record<string, { icon: typeof Zap; color: string; accent: string }> = {
  stim_pack:  { icon: Zap,        color: 'text-yellow-400', accent: 'border-yellow-400/40 hover:border-yellow-400/70' },
  cryo_pod:   { icon: Snowflake,  color: 'text-cyan-400',   accent: 'border-cyan-400/40 hover:border-cyan-400/70' },
  full_reset: { icon: RotateCcw,  color: 'text-violet-400', accent: 'border-violet-400/40 hover:border-violet-400/70' },
};

function formatDuration(hours: number): string {
  if (hours >= 24) return `${hours / 24}d`;
  return `${hours}h`;
}

function describeFatigueEffect(def: TreatmentDef): string {
  if (def.fatigue_reduction === null) return 'Fatigue → 0%';
  return `Fatigue −${def.fatigue_reduction}%`;
}

function describeSharpnessEffect(def: TreatmentDef): string {
  if (def.sharpness_set === null) return 'Sharpness unchanged';
  return `Sharpness → ${def.sharpness_set}%`;
}

export default function Treatment() {
  const { creatureId } = useParams();
  const navigate = useNavigate();
  const { address, walletType, buildAndSubmitEntryFee } = useWallet();

  const [selectedTier, setSelectedTier] = useState<{ key: string; def: TreatmentDef } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [treatmentResult, setTreatmentResult] = useState<TreatmentStartResponse | null>(null);
  const [treatmentError, setTreatmentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  // ErgoPay
  const [ergoPayTx, setErgoPayTx] = useState<ErgoPayTxRequest | null>(null);
  const [showErgoPayModal, setShowErgoPayModal] = useState(false);

  const { data: creature, loading: creatureLoading, refetch: refetchCreature } = useCreature(creatureId || null);
  const { data: userCreatures, loading: creaturesLoading } = useCreaturesByWallet(address);
  const { data: collections } = useCollections();
  const { active: activeCollections, toggle: toggleCollection, matches: matchesCollection } = useCollectionFilter();
  const { data: gameConfig } = useGameConfig();
  const treatmentMutation = useTreatment();

  const treatments = gameConfig?.treatments ?? {};
  const requireFees = gameConfig?.requireFees ?? false;
  const treasuryErgoTree = gameConfig?.treasuryErgoTree ?? '';

  const handleErgoPaySuccess = useCallback((result: any, txId: string) => {
    setShowErgoPayModal(false);
    setErgoPayTx(null);
    setLastTxId(txId || null);
    setTreatmentResult(result);
    setShowResult(true);
  }, []);

  const handleErgoPayExpired = useCallback(() => {
    setShowErgoPayModal(false);
    setErgoPayTx(null);
    setTreatmentError('Payment expired. Please try again.');
  }, []);

  // ── Selection view ──────────────────────────────────────────────
  if (!creatureId) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Treatment Center
          </h1>
          <p className="text-muted-foreground mb-6">
            Select a creature for deep recovery
          </p>

          <CollectionFilter
            collections={collections || []}
            active={activeCollections}
            onToggle={toggleCollection}
            className="mb-4"
          />

          {creaturesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : !userCreatures || userCreatures.length === 0 ? (
            <div className="cyber-card rounded-xl p-8 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                You don't have any creatures yet. Register an NFT first.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userCreatures.filter((c) => matchesCollection(c.collectionId)).map((c) => {
                const inTreatment = c.treatment && new Date(c.treatment.endsAt) > new Date();
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/treatment/${c.id}`)}
                    className={cn(
                      'cyber-card rounded-xl p-4 text-left transition-all duration-200 hover:border-primary/50 hover:scale-[1.02]',
                      inTreatment && 'ring-1 ring-orange-400/40',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <PetImage
                        src={c.imageUrl}
                        fallbackSrc={c.fallbackImageUrl}
                        alt={c.name}
                        className="w-12 h-12 rounded-lg shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-lg font-semibold text-foreground">
                            {c.name}
                          </h3>
                          {inTreatment && (
                            <TreatmentTimer
                              endsAt={c.treatment!.endsAt}
                              compact
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{c.rarity}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span className="text-muted-foreground">
                        Fatigue: <span className={c.fatigue > 60 ? 'text-destructive' : 'text-foreground'}>{c.fatigue}%</span>
                      </span>
                      <span className="text-muted-foreground">
                        Sharpness: <span className="text-primary">{c.sharpness}%</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </MainLayout>
    );
  }

  // ── Treatment detail view ──────────────────────────────────────
  if (creatureLoading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!creature) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-muted-foreground">Creature not found</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/treatment">Back to Treatment Center</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const inTreatment = creature.treatment && new Date(creature.treatment.endsAt) > new Date();

  const handleSelectTier = (key: string, def: TreatmentDef) => {
    setSelectedTier({ key, def });
    setShowConfirm(true);
    setTreatmentError(null);
  };

  const handleConfirm = async () => {
    if (!selectedTier || !creatureId || !address || !creature) return;
    setTreatmentError(null);
    setIsSubmitting(true);

    try {
      if (!requireFees) {
        // Alpha: no fees
        setLastTxId(null);
        const result = await (treatmentMutation.mutate as any)(
          creatureId,
          selectedTier.key,
          address,
        );
        setTreatmentResult(result);
        setShowConfirm(false);
        setShowResult(true);
      } else if (walletType === 'nautilus') {
        const txId = await buildAndSubmitEntryFee(selectedTier.def.cost_nanoerg, treasuryErgoTree, {
          actionType: 'treatment',
          tokenId: creature.tokenId,
          context: selectedTier.key,
        });
        setLastTxId(txId);
        const result = await (treatmentMutation.mutate as any)(
          creatureId,
          selectedTier.key,
          address,
          txId,
        );
        setTreatmentResult(result);
        setShowConfirm(false);
        setShowResult(true);
      } else if (walletType === 'ergopay') {
        setShowConfirm(false);
        const txReq = await requestErgoPayTx({
          actionType: 'treatment_fee',
          walletAddress: address,
          creatureId,
          treatmentType: selectedTier.key,
        });
        setErgoPayTx(txReq);
        setShowErgoPayModal(true);
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      setTreatmentError(err instanceof Error ? err.message : 'Treatment failed');
      setShowConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResultClose = () => {
    setShowResult(false);
    setSelectedTier(null);
    setTreatmentResult(null);
    setLastTxId(null);
    refetchCreature();
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-muted-foreground hover:text-foreground"
        >
          <Link to="/treatment">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Treatment Center
          </Link>
        </Button>

        {/* Creature header */}
        <div className="cyber-card rounded-xl p-4">
          <div className="flex items-center gap-4">
            <PetImage
              src={creature.imageUrl}
              fallbackSrc={creature.fallbackImageUrl}
              alt={creature.name}
              className="w-16 h-16 rounded-lg shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-xl font-semibold text-foreground">
                {creature.name}
              </h2>
              <p className="text-xs text-muted-foreground capitalize">{creature.rarity}</p>
              <div className="mt-1 flex gap-4 text-sm">
                <span className="text-muted-foreground">
                  Fatigue: <span className={cn(
                    'font-mono font-semibold',
                    creature.fatigue > 60 ? 'text-destructive' : 'text-foreground',
                  )}>{creature.fatigue}%</span>
                </span>
                <span className="text-muted-foreground">
                  Sharpness: <span className="font-mono font-semibold text-primary">{creature.sharpness}%</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Already in treatment — show timer */}
        {inTreatment && (
          <div className="cyber-card rounded-xl p-6 border-orange-400/30 bg-orange-400/5">
            <div className="flex flex-col items-center gap-4">
              <Clock className="w-8 h-8 text-orange-400" />
              <h3 className="font-display text-lg font-semibold text-orange-400">
                Treatment In Progress
              </h3>
              <TreatmentTimer
                endsAt={creature.treatment!.endsAt}
                treatmentName={treatments[creature.treatment!.type]?.name ?? creature.treatment!.type}
              />
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                Your creature is locked from training and racing until treatment completes.
                Effects will be applied automatically.
              </p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {treatmentError && (
          <div className="cyber-card rounded-lg p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{treatmentError}</p>
            </div>
          </div>
        )}

        {/* Treatment tiers — only when NOT in treatment */}
        {!inTreatment && (
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground mb-4">
              Choose Treatment
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(treatments).map(([key, def], index) => {
                const meta = TIER_META[key] ?? { icon: Zap, color: 'text-primary', accent: 'border-primary/40 hover:border-primary/70' };
                const Icon = meta.icon;
                const costErg = def.cost_nanoerg / 1_000_000_000;

                return (
                  <button
                    key={key}
                    onClick={() => handleSelectTier(key, def)}
                    className={cn(
                      'cyber-card rounded-xl p-5 text-left transition-all duration-200 hover:scale-[1.02] border-2',
                      meta.accent,
                      'animate-slide-up',
                    )}
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn('p-2 rounded-lg bg-muted/50', meta.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-foreground">{def.name}</h3>
                        <span className="text-xs text-muted-foreground">{formatDuration(def.duration_hours)} lockout</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Fatigue</span>
                        <span className="font-mono text-accent">{describeFatigueEffect(def)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Sharpness</span>
                        <span className={cn(
                          'font-mono',
                          def.sharpness_set !== null ? 'text-primary' : 'text-muted-foreground',
                        )}>
                          {describeSharpnessEffect(def)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Cost</span>
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {costErg} ERG
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Confirm Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="cyber-card border-primary/30 max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-foreground">
                Confirm Treatment
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedTier?.def.name} for {creature.name}
              </DialogDescription>
            </DialogHeader>

            {selectedTier && (
              <div className="space-y-3 py-2">
                <div className="cyber-card rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-mono text-foreground">{formatDuration(selectedTier.def.duration_hours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fatigue Effect</span>
                    <span className="font-mono text-accent">{describeFatigueEffect(selectedTier.def)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sharpness Effect</span>
                    <span className="font-mono text-primary">{describeSharpnessEffect(selectedTier.def)}</span>
                  </div>
                  {requireFees && (
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">Cost</span>
                      <span className="font-mono font-semibold text-foreground">
                        {(selectedTier.def.cost_nanoerg / 1_000_000_000).toFixed(4)} ERG
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Your creature will be locked from training and racing for the full duration.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="border-muted-foreground/30"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground"
              >
                {isSubmitting ? 'Starting...' : 'Start Treatment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Result Dialog */}
        <Dialog open={showResult} onOpenChange={handleResultClose}>
          <DialogContent className="cyber-card border-accent/30 max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-foreground">
                Treatment Started
              </DialogTitle>
            </DialogHeader>

            {treatmentResult && (
              <div className="flex flex-col items-center gap-4 py-4">
                <CheckCircle2 className="w-12 h-12 text-accent" />
                <p className="text-sm text-foreground font-semibold">
                  {treatmentResult.treatmentName}
                </p>
                <div className="cyber-card rounded-lg p-3 w-full space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-mono text-foreground">{formatDuration(treatmentResult.durationHours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completes at</span>
                    <span className="font-mono text-foreground text-xs">
                      {new Date(treatmentResult.endsAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                {lastTxId && (
                  <a
                    href={`${EXPLORER_TX_URL}${lastTxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-mono transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="break-all">View on Explorer</span>
                  </a>
                )}
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleResultClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ErgoPay Modal */}
        {ergoPayTx && (
          <ErgoPayTxModal
            open={showErgoPayModal}
            onOpenChange={setShowErgoPayModal}
            ergoPayUrl={ergoPayTx.ergoPayUrl}
            requestId={ergoPayTx.requestId}
            amount={ergoPayTx.amount}
            description="Treatment fee payment"
            onSuccess={handleErgoPaySuccess}
            onExpired={handleErgoPayExpired}
          />
        )}
      </div>
    </MainLayout>
  );
}

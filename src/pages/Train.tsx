import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, History } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCreature, useCreaturesByWallet, useTrain, useTrainingLog, useGameConfig } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { trainingActivities as defaultActivities } from '@/data/trainingActivities';
import { TrainingActivity, TrainResponse, Activity, StatBlock, StatType } from '@/types/game';
import { CreatureTrainHeader } from '@/components/training/CreatureTrainHeader';
import { ActivityCard } from '@/components/training/ActivityCard';
import { TrainingConfirmModal } from '@/components/training/TrainingConfirmModal';
import { TrainingResultModal } from '@/components/training/TrainingResultModal';
import { BoostBanner } from '@/components/training/BoostBanner';
import { ActionsDisplay } from '@/components/training/ActionsDisplay';
import { RewardBadges } from '@/components/creatures/RewardBadges';
import { TrainingLog } from '@/components/creatures/TrainingLog';

export default function Train() {
  const { creatureId } = useParams();
  const navigate = useNavigate();
  const { address } = useWallet();
  const [selectedActivity, setSelectedActivity] = useState<TrainingActivity | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [trainResult, setTrainResult] = useState<TrainResponse | null>(null);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  // Snapshot creature state before training so result modal shows correct old→new
  const [preTrainStats, setPreTrainStats] = useState<{ trained: StatBlock; base: StatBlock } | null>(null);
  const [preTrainBoost, setPreTrainBoost] = useState(0);
  const [currentBlockHeight, setCurrentBlockHeight] = useState<number | null>(null);

  const { data: creature, loading: creatureLoading, refetch: refetchCreature } = useCreature(creatureId || null);
  const { data: userCreatures, loading: creaturesLoading } = useCreaturesByWallet(address);
  const { data: trainingLogs, loading: logsLoading, refetch: refetchLogs } = useTrainingLog(creatureId || null);
  const { data: gameConfig } = useGameConfig();
  const train = useTrain();

  // Merge real gain values from game_config into activity definitions.
  // Falls back to hardcoded defaults if config hasn't loaded yet.
  const trainingActivities: TrainingActivity[] = defaultActivities.map((activity) => {
    const serverDef = gameConfig?.activities?.[activity.id];
    if (!serverDef) return activity;
    return {
      ...activity,
      primaryStat: (serverDef.primary as StatType) ?? activity.primaryStat,
      secondaryStat: (serverDef.secondary as StatType) ?? activity.secondaryStat,
      primaryGain: serverDef.primary_gain ?? activity.primaryGain,
      secondaryGain: serverDef.secondary_gain ?? activity.secondaryGain,
      fatigueCost: serverDef.fatigue_cost ?? activity.fatigueCost,
    };
  });

  // Fetch current Ergo block height once for boost expiry display
  useEffect(() => {
    fetch('https://api.ergoplatform.com/api/v1/blocks?limit=1')
      .then(r => r.json())
      .then(data => {
        const height = data?.items?.[0]?.height;
        if (height) setCurrentBlockHeight(height);
      })
      .catch(() => {});
  }, []);

  // If no creature selected, show selection view
  if (!creatureId) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
            Training Center
          </h1>
          <p className="text-muted-foreground mb-6">
            Select a creature to begin training
          </p>

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
                You don't have any creatures yet. Register an NFT to start training.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userCreatures.map((c) => {
                // TEMPORARY: Cooldown disabled for alpha testing
                // const isOnCooldown = c.cooldownEndsAt && new Date(c.cooldownEndsAt) > new Date();
                const isOnCooldown = false;
                const hasRewards = c.bonusActions > 0 || c.boosts.length > 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/train/${c.id}`)}
                    className={`cyber-card rounded-xl p-4 text-left transition-all duration-200
                      hover:border-primary/50 hover:scale-[1.02]
                      ${hasRewards ? 'ring-1 ring-primary/30' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {c.imageUrl && (
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-lg font-semibold text-foreground">
                            {c.name}
                          </h3>
                          {isOnCooldown && (
                            <span className="text-xs text-muted-foreground font-mono">
                              On cooldown
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{c.rarity}</p>
                        <RewardBadges
                          bonusActions={c.bonusActions}
                          boosts={c.boosts}
                          compact
                        />
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

  if (creatureLoading) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto space-y-6">
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
            <Link to="/train">Back to Training</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  // TEMPORARY: Cooldown disabled for alpha testing
  // const isOnCooldown = creature.cooldownEndsAt && new Date(creature.cooldownEndsAt) > new Date();
  const isOnCooldown = false;

  const handleSelectActivity = (activity: TrainingActivity) => {
    setSelectedActivity(activity);
    setShowConfirm(true);
  };

  const handleConfirmTraining = async (selectedBoostIds: string[]) => {
    if (!selectedActivity || !creatureId || !address || !creature) return;
    setShowConfirm(false);
    setTrainError(null);
    setIsTraining(true);

    // Snapshot pre-training state before refetch overwrites it
    setPreTrainStats({ trained: { ...creature.trainedStats }, base: { ...creature.baseStats } });
    // Compute the boost total from selected IDs
    const selectedBoostTotal = creature.boosts
      .filter(b => selectedBoostIds.includes(b.id))
      .reduce((sum, b) => sum + b.multiplier, 0);
    setPreTrainBoost(selectedBoostTotal);

    try {
      const result = await train.mutate(
        creatureId,
        selectedActivity.id as Activity,
        address,
        selectedBoostIds.length > 0 ? selectedBoostIds : undefined,
      );
      setTrainResult(result);
      setShowResult(true);
      refetchCreature();
      refetchLogs();
    } catch (err) {
      setTrainError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setIsTraining(false);
    }
  };

  const handleResultClose = () => {
    setShowResult(false);
    setSelectedActivity(null);
    setTrainResult(null);
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-muted-foreground hover:text-foreground"
        >
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>

        <CreatureTrainHeader creature={creature} />
        <ActionsDisplay
          actionsRemaining={creature.actionsRemaining}
          maxActionsToday={creature.maxActionsToday}
          bonusActions={creature.bonusActions}
        />
        <BoostBanner boosts={creature.boosts} currentBlockHeight={currentBlockHeight} />

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="border-muted-foreground/30">
              <History className="w-4 h-4 mr-2" />
              Training Log
            </Button>
          </SheetTrigger>
          <SheetContent className="cyber-card border-l-primary/20 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="font-display text-lg text-foreground">
                Training History
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {logsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <TrainingLog logs={(trainingLogs || []).slice(0, 20)} />
              )}
            </div>
          </SheetContent>
        </Sheet>

        {isOnCooldown && (
          <div className="cyber-card rounded-lg p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">
                This creature is on cooldown and cannot train right now.
              </p>
            </div>
          </div>
        )}

        {trainError && (
          <div className="cyber-card rounded-lg p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <div className="text-sm">
                <p className="text-destructive">{trainError}</p>
                {trainError.toLowerCase().includes('cooldown') && (
                  <Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors underline underline-offset-2">
                    Learn more about cooldowns and training in the FAQ
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {isTraining && (
          <div className="cyber-card rounded-lg p-4 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-primary">Training in progress...</p>
            </div>
          </div>
        )}

        <div>
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">
            Choose Training Activity
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainingActivities.map((activity, index) => (
              <div
                key={activity.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <ActivityCard
                  activity={activity}
                  disabled={isOnCooldown || creature.actionsRemaining === 0 || isTraining}
                  onSelect={handleSelectActivity}
                  hasBoostsAvailable={creature.boosts.length > 0}
                />
              </div>
            ))}
          </div>
        </div>

        <TrainingConfirmModal
          open={showConfirm}
          onOpenChange={setShowConfirm}
          creature={creature}
          activity={selectedActivity}
          currentBlockHeight={currentBlockHeight}
          onConfirm={handleConfirmTraining}
        />

        <TrainingResultModal
          open={showResult}
          onOpenChange={handleResultClose}
          creature={creature}
          activity={selectedActivity}
          boostMultiplier={preTrainBoost}
          preTrainStats={preTrainStats}
          trainResult={trainResult}
        />
      </div>
    </MainLayout>
  );
}

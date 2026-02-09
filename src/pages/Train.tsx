import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreature, useCreaturesByWallet, useTrain } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { trainingActivities } from '@/data/trainingActivities';
import { TrainingActivity, TrainResponse, Activity } from '@/types/game';
import { CreatureTrainHeader } from '@/components/training/CreatureTrainHeader';
import { ActivityCard } from '@/components/training/ActivityCard';
import { TrainingConfirmModal } from '@/components/training/TrainingConfirmModal';
import { TrainingResultModal } from '@/components/training/TrainingResultModal';
import { BoostBanner } from '@/components/training/BoostBanner';
import { ActionsDisplay } from '@/components/training/ActionsDisplay';
import { RewardBadges } from '@/components/creatures/RewardBadges';

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

  const { data: creature, loading: creatureLoading, refetch: refetchCreature } = useCreature(creatureId || null);
  const { data: userCreatures, loading: creaturesLoading } = useCreaturesByWallet(address);
  const train = useTrain();

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
                const isOnCooldown = c.cooldownEndsAt && new Date(c.cooldownEndsAt) > new Date();
                const hasRewards = c.bonusActions > 0 || c.boostMultiplier > 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => !isOnCooldown && navigate(`/train/${c.id}`)}
                    disabled={isOnCooldown}
                    className={`cyber-card rounded-xl p-4 text-left transition-all duration-200
                      ${isOnCooldown 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:border-primary/50 hover:scale-[1.02]'
                      }
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
                          boostMultiplier={c.boostMultiplier}
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

  const isOnCooldown = creature.cooldownEndsAt && new Date(creature.cooldownEndsAt) > new Date();

  const handleSelectActivity = (activity: TrainingActivity) => {
    setSelectedActivity(activity);
    setShowConfirm(true);
  };

  const handleConfirmTraining = async () => {
    if (!selectedActivity || !creatureId || !address) return;
    setShowConfirm(false);
    setTrainError(null);
    setIsTraining(true);

    try {
      const result = await train.mutate(creatureId, selectedActivity.id as Activity, address);
      setTrainResult(result);
      setShowResult(true);
      refetchCreature();
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
        <BoostBanner boostMultiplier={creature.boostMultiplier} />

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
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{trainError}</p>
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
                  boostMultiplier={creature.boostMultiplier}
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
          onConfirm={handleConfirmTraining}
        />

        <TrainingResultModal
          open={showResult}
          onOpenChange={handleResultClose}
          creature={creature}
          activity={selectedActivity}
          boostMultiplier={creature.boostMultiplier}
          trainResult={trainResult}
        />
      </div>
    </MainLayout>
  );
}

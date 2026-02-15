import { Link } from 'react-router-dom';
import { Dumbbell, Flag, Stethoscope } from 'lucide-react';
import { CreatureWithStats, StatType } from '@/types/game';
import { Button } from '@/components/ui/button';
import { StatBar, ConditionGauge, RarityBadge } from './StatBar';
import { CooldownTimer } from './CooldownTimer';
import { TreatmentTimer } from './TreatmentTimer';
import { RewardBadges } from './RewardBadges';
import { ActionsDisplay } from '../training/ActionsDisplay';
import { PetImage } from './PetImage';
import { cn } from '@/lib/utils';

interface CreatureCardProps {
  creature: CreatureWithStats;
  className?: string;
  style?: React.CSSProperties;
}

const statOrder: StatType[] = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'];

export function CreatureCard({ creature, className, style }: CreatureCardProps) {
  const isOnCooldown = creature.cooldownEndsAt && new Date(creature.cooldownEndsAt) > new Date();
  const inTreatment = creature.treatment && new Date(creature.treatment.endsAt) > new Date();
  const isLocked = isOnCooldown || inTreatment;
  const hasRewards = creature.bonusActions > 0 || creature.boosts.length > 0;

  return (
    <div 
      className={cn(
        'cyber-card rounded-xl p-4 flex flex-col gap-4 animate-fade-in',
        hasRewards && 'ring-1 ring-primary/30',
        className
      )}
      style={style}
    >
      {/* Header - Clickable to profile */}
      <Link
        to={`/creatures/${creature.id}`}
        className="flex items-start gap-3 group"
      >
        <PetImage
          src={creature.imageUrl}
          fallbackSrc={creature.fallbackImageUrl}
          alt={creature.name}
          className="w-14 h-14 rounded-lg shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                {creature.name}
              </h3>
              <RarityBadge rarity={creature.rarity} />
              <RewardBadges
                bonusActions={creature.bonusActions}
                boosts={creature.boosts}
                compact
              />
            </div>
            {creature.prestige.tier > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/20">
                <span className="text-secondary text-xs font-mono">P{creature.prestige.tier}</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Stats */}
      <div className="flex flex-col gap-1.5">
        {statOrder.map((stat) => (
          <StatBar
            key={stat}
            stat={stat}
            baseValue={creature.baseStats[stat]}
            trainedValue={creature.trainedStats[stat]}
          />
        ))}
      </div>

      {/* Condition Gauges */}
      <div className="flex flex-col gap-1 pt-2 border-t border-border">
        <ConditionGauge type="fatigue" value={creature.fatigue} />
        <ConditionGauge type="sharpness" value={creature.sharpness} />
      </div>

      {/* Actions & Cooldown / Treatment */}
      <div className="flex flex-col items-center gap-2">
        <ActionsDisplay
          actionsRemaining={creature.actionsRemaining}
          maxActionsToday={creature.maxActionsToday}
          bonusActions={creature.bonusActions}
        />
        {inTreatment ? (
          <TreatmentTimer
            endsAt={creature.treatment!.endsAt}
            treatmentName={creature.treatment!.type.replace(/_/g, ' ')}
          />
        ) : (
          <CooldownTimer endsAt={creature.cooldownEndsAt} />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn(
            'flex-1 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary',
            isLocked && 'opacity-50 pointer-events-none'
          )}
          disabled={!!isLocked}
        >
          <Link to={`/train/${creature.id}`}>
            <Dumbbell className="w-4 h-4 mr-2" />
            Train
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn(
            'flex-1 border-secondary/50 text-secondary hover:bg-secondary/10 hover:border-secondary',
            inTreatment && 'opacity-50 pointer-events-none'
          )}
          disabled={!!inTreatment}
        >
          <Link to="/races">
            <Flag className="w-4 h-4 mr-2" />
            Race
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="flex-1 border-orange-400/50 text-orange-400 hover:bg-orange-400/10 hover:border-orange-400"
        >
          <Link to={`/treatment/${creature.id}`}>
            <Stethoscope className="w-4 h-4 mr-2" />
            Treat
          </Link>
        </Button>
      </div>
    </div>
  );
}

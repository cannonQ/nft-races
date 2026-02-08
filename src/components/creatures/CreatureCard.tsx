import { Link } from 'react-router-dom';
import { Dumbbell, Flag } from 'lucide-react';
import { CreatureWithStats, StatType } from '@/types/game';
import { Button } from '@/components/ui/button';
import { StatBar, ConditionGauge, RarityBadge } from './StatBar';
import { CooldownTimer } from './CooldownTimer';
import { RewardBadges } from './RewardBadges';
import { cn } from '@/lib/utils';

interface CreatureCardProps {
  creature: CreatureWithStats;
  className?: string;
  style?: React.CSSProperties;
}

const statOrder: StatType[] = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'];

export function CreatureCard({ creature, className, style }: CreatureCardProps) {
  const isOnCooldown = creature.cooldownEndsAt && new Date(creature.cooldownEndsAt) > new Date();
  const hasRewards = creature.bonusActions > 0 || creature.boostMultiplier > 0;

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
        className="flex items-start justify-between group"
      >
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
            {creature.name}
          </h3>
          <RarityBadge rarity={creature.rarity} />
          {/* Reward Badges */}
          <RewardBadges 
            bonusActions={creature.bonusActions} 
            boostMultiplier={creature.boostMultiplier}
            compact
          />
        </div>
        {creature.prestige.tier > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-secondary/20">
            <span className="text-secondary text-xs font-mono">P{creature.prestige.tier}</span>
          </div>
        )}
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

      {/* Cooldown Timer */}
      <div className="flex justify-center">
        <CooldownTimer endsAt={creature.cooldownEndsAt} />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn(
            'flex-1 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary',
            isOnCooldown && 'opacity-50 pointer-events-none'
          )}
          disabled={isOnCooldown}
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
            isOnCooldown && 'opacity-50 pointer-events-none'
          )}
          disabled={isOnCooldown}
        >
          <Link to="/races">
            <Flag className="w-4 h-4 mr-2" />
            Race
          </Link>
        </Button>
      </div>
    </div>
  );
}

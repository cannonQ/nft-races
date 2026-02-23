import { CreatureWithStats, StatType } from '@/types/game';
import { PetImage } from '@/components/creatures/PetImage';
import { cn, fmtStat } from '@/lib/utils';
import { RarityBadge, ConditionGauge } from '@/components/creatures/StatBar';
import { CooldownTimer } from '@/components/creatures/CooldownTimer';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface CreatureTrainHeaderProps {
  creature: CreatureWithStats;
}

const statOrder: StatType[] = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'];

const statColors: Record<StatType, string> = {
  speed: 'bg-stat-speed',
  stamina: 'bg-stat-stamina',
  accel: 'bg-stat-acceleration',
  agility: 'bg-stat-agility',
  heart: 'bg-stat-heart',
  focus: 'bg-stat-focus',
};

const statLabels: Record<StatType, string> = {
  speed: 'SPD',
  stamina: 'STA',
  accel: 'ACC',
  agility: 'AGI',
  heart: 'HRT',
  focus: 'FOC',
};

export function CreatureTrainHeader({ creature }: CreatureTrainHeaderProps) {
  return (
    <div className="cyber-card rounded-xl p-4 md:p-6">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Left: Creature Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link to="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">Training</span>
          </div>
          
          <div className="flex items-start gap-4">
            <PetImage
              src={creature.imageUrl}
              fallbackSrc={creature.fallbackImageUrl}
              alt={creature.name}
              className="w-16 h-16 rounded-xl shrink-0"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                  {creature.name}
                </h1>
                <RarityBadge rarity={creature.rarity} />
                {creature.prestige.tier > 0 && (
                  <div className="px-2 py-0.5 rounded bg-secondary/20 text-secondary text-xs font-mono">
                    P{creature.prestige.tier}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                <span>
                  <span className="font-mono text-foreground">{creature.totalRaces}</span> Races
                </span>
                <span>
                  <span className="font-mono text-accent">{creature.prestige.lifetimeWins}</span> Wins
                </span>
                <span>
                  <span className="font-mono text-primary">{creature.totalEarnings.toLocaleString()} ERG</span> Earned
                </span>
              </div>
            </div>
          </div>

          {/* Condition & Cooldown */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <ConditionGauge type="fatigue" value={creature.fatigue} />
              <ConditionGauge type="sharpness" value={creature.sharpness} />
            </div>
            <div className="flex items-center">
              <CooldownTimer endsAt={creature.cooldownEndsAt} />
            </div>
          </div>
        </div>

        {/* Right: Stat Bar Chart */}
        <div className="lg:w-72">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Current Stats
          </h3>
          <div className="space-y-2">
            {statOrder.map((stat) => {
              const total = creature.baseStats[stat] + creature.trainedStats[stat];
              return (
                <div key={stat} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground w-7">
                    {statLabels[stat]}
                  </span>
                  <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
                    {/* Base portion */}
                    <div className="h-full flex">
                      <div 
                        className={cn('h-full', statColors[stat], 'opacity-60')}
                        style={{ width: `${creature.baseStats[stat]}%` }}
                      />
                      {/* Trained portion - brighter */}
                      <div 
                        className={cn('h-full', statColors[stat])}
                        style={{ width: `${creature.trainedStats[stat]}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-xs text-foreground w-8 text-right">
                    {fmtStat(total)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

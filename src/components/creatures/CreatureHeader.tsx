import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Star, Zap, Dumbbell, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreatureWithStats, Rarity } from '@/types/game';
import { RewardBadges } from './RewardBadges';
import { CooldownTimer } from './CooldownTimer';
import { ActionsDisplay } from '../training/ActionsDisplay';
import { PetImage } from './PetImage';
import { cn } from '@/lib/utils';

interface CreatureHeaderProps {
  creature: CreatureWithStats;
}

const rarityStyles: Record<Rarity, { bg: string; text: string; border: string }> = {
  common: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-muted' },
  uncommon: { bg: 'bg-rarity-uncommon/10', text: 'text-rarity-uncommon', border: 'border-rarity-uncommon/30' },
  rare: { bg: 'bg-rarity-rare/10', text: 'text-rarity-rare', border: 'border-rarity-rare/30' },
  masterwork: { bg: 'bg-rarity-masterwork/10', text: 'text-rarity-masterwork', border: 'border-rarity-masterwork/30' },
  epic: { bg: 'bg-rarity-epic/10', text: 'text-rarity-epic', border: 'border-rarity-epic/30' },
  relic: { bg: 'bg-rarity-relic/10', text: 'text-rarity-relic', border: 'border-rarity-relic/30' },
  legendary: { bg: 'bg-rarity-legendary/10', text: 'text-rarity-legendary', border: 'border-rarity-legendary/30' },
  mythic: { bg: 'bg-rarity-mythic/10', text: 'text-rarity-mythic', border: 'border-rarity-mythic/30' },
  cyberium: { bg: 'bg-rarity-mythic/10', text: 'text-rarity-mythic', border: 'border-rarity-mythic/30' },
};

const defaultStyle = { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-muted' };

export function CreatureHeader({ creature }: CreatureHeaderProps) {
  const navigate = useNavigate();
  const style = rarityStyles[creature.rarity] ?? defaultStyle;
  const isOnCooldown = creature.cooldownEndsAt && new Date(creature.cooldownEndsAt) > new Date();
  const winRate = creature.totalRaces > 0
    ? Math.round((creature.prestige.lifetimeWins / creature.totalRaces) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {/* Header Card */}
      <div className={cn(
        'cyber-card rounded-xl p-5 border',
        creature.rarity === 'cyberium' && 'holographic-card',
        style.border
      )}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* NFT Image */}
          {creature.imageUrl || creature.fallbackImageUrl ? (
            <PetImage
              src={creature.imageUrl}
              fallbackSrc={creature.fallbackImageUrl}
              alt={creature.name}
              className="w-20 h-20 rounded-xl shrink-0"
            />
          ) : (
            <div className={cn(
              'w-20 h-20 rounded-xl flex items-center justify-center shrink-0',
              style.bg
            )}>
              <Zap className={cn('w-10 h-10', style.text)} />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {creature.name}
              </h1>
              <Badge variant="outline" className={cn('uppercase text-[10px]', style.text, style.border)}>
                {creature.rarity}
              </Badge>
              {creature.prestige.tier > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="w-3 h-3" />
                  Prestige {creature.prestige.tier}
                </Badge>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-race-sprint" />
                <span className="font-mono text-foreground">
                  {creature.prestige.lifetimeWins}/{creature.prestige.lifetimePlaces}/{creature.prestige.lifetimeShows}
                </span>
                <span className="text-muted-foreground text-xs">W/P/S</span>
              </div>
              <div className="text-muted-foreground">
                <span className="font-mono text-foreground">{creature.totalRaces}</span> races
              </div>
              <div className="text-muted-foreground">
                <span className="font-mono text-foreground">{winRate}%</span> win rate
              </div>
              {creature.totalEarnings > 0 && (
                <div className="text-accent font-mono font-semibold">
                  +{creature.totalEarnings.toFixed(2)} <span className="text-xs text-muted-foreground font-normal">ERG</span>
                </div>
              )}
            </div>

            {/* Training Status */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <CooldownTimer endsAt={creature.cooldownEndsAt} />
              <ActionsDisplay
                actionsRemaining={creature.actionsRemaining}
                maxActionsToday={creature.maxActionsToday}
                bonusActions={creature.bonusActions}
              />
            </div>

            {/* Claimable Rewards */}
            {(creature.bonusActions > 0 || creature.boosts.length > 0) && (
              <div className="mt-3 p-2 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-[10px] text-primary uppercase tracking-wider font-semibold mb-1">
                  Rewards Available
                </p>
                <RewardBadges
                  bonusActions={creature.bonusActions}
                  boosts={creature.boosts}
                />
              </div>
            )}
          </div>

          {/* Train Button */}
          <Button
            asChild
            className={cn(
              'shrink-0',
              isOnCooldown
                ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                : 'bg-primary hover:bg-primary/90'
            )}
          >
            <Link to={`/train/${creature.id}`}>
              {isOnCooldown ? (
                <>
                  <Timer className="w-4 h-4 mr-2" />
                  On Cooldown
                </>
              ) : (
                <>
                  <Dumbbell className="w-4 h-4 mr-2" />
                  Train Now
                </>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

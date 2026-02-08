import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Race, RaceType, Rarity } from '@/types/game';
import { formatCountdown } from '@/lib/utils';
import { Clock, Users, Coins, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface RaceEntrant {
  id: string;
  creatureName: string;
  creatureRarity: Rarity;
  ownerAddress: string;
  isCurrentUser: boolean;
}

// Mock entrants data
const mockEntrants: Record<string, RaceEntrant[]> = {
  race_001: [
    { id: '1', creatureName: 'Thunder Bolt', creatureRarity: 'legendary', ownerAddress: '0x3c1F...8a2D', isCurrentUser: false },
    { id: '2', creatureName: 'Plasma Storm', creatureRarity: 'mythic', ownerAddress: '0x9d4E...2c1A', isCurrentUser: false },
    { id: '3', creatureName: 'Frost Weaver', creatureRarity: 'epic', ownerAddress: '0x5f2B...7e3C', isCurrentUser: false },
    { id: '4', creatureName: 'Voltex Prime', creatureRarity: 'legendary', ownerAddress: '0x7a3B...4f2E', isCurrentUser: true },
    { id: '5', creatureName: 'Dark Specter', creatureRarity: 'rare', ownerAddress: '0x2b8A...1d5F', isCurrentUser: false },
  ],
  race_002: [
    { id: '1', creatureName: 'Endurance King', creatureRarity: 'epic', ownerAddress: '0x4a2C...9b3E', isCurrentUser: false },
    { id: '2', creatureName: 'Marathon Master', creatureRarity: 'legendary', ownerAddress: '0x8c5D...2f4A', isCurrentUser: false },
    { id: '3', creatureName: 'Shadow Runner', creatureRarity: 'epic', ownerAddress: '0x7a3B...4f2E', isCurrentUser: true },
    { id: '4', creatureName: 'Iron Legs', creatureRarity: 'rare', ownerAddress: '0x1e7B...6c2D', isCurrentUser: false },
    { id: '5', creatureName: 'Steady Strider', creatureRarity: 'uncommon', ownerAddress: '0x6d3F...4a1C', isCurrentUser: false },
    { id: '6', creatureName: 'Long Haul', creatureRarity: 'rare', ownerAddress: '0x9f2E...7b5A', isCurrentUser: false },
    { id: '7', creatureName: 'Pace Keeper', creatureRarity: 'epic', ownerAddress: '0x3a4B...8c2D', isCurrentUser: false },
    { id: '8', creatureName: 'Distance Demon', creatureRarity: 'legendary', ownerAddress: '0x5c1D...3e4F', isCurrentUser: false },
  ],
  race_003: [
    { id: '1', creatureName: 'Precision Strike', creatureRarity: 'legendary', ownerAddress: '0x2b8A...1d5F', isCurrentUser: false },
    { id: '2', creatureName: 'Nimble Ghost', creatureRarity: 'epic', ownerAddress: '0x4c3E...9a2B', isCurrentUser: false },
    { id: '3', creatureName: 'Quick Turn', creatureRarity: 'rare', ownerAddress: '0x7d5F...2c4A', isCurrentUser: false },
    { id: '4', creatureName: 'Cyber Phantom', creatureRarity: 'cyberium', ownerAddress: '0x7a3B...4f2E', isCurrentUser: true },
    { id: '5', creatureName: 'Slick Slider', creatureRarity: 'epic', ownerAddress: '0x8a2C...5b3D', isCurrentUser: false },
    { id: '6', creatureName: 'Angle Master', creatureRarity: 'legendary', ownerAddress: '0x1f4A...6c2E', isCurrentUser: false },
  ],
  race_004: [
    { id: '1', creatureName: 'Chaos Rider', creatureRarity: 'mythic', ownerAddress: '0x5d2B...4a1C', isCurrentUser: false },
    { id: '2', creatureName: 'Hazard Hunter', creatureRarity: 'legendary', ownerAddress: '0x9c3E...7b5A', isCurrentUser: false },
    { id: '3', creatureName: 'Neon Striker', creatureRarity: 'rare', ownerAddress: '0x7a3B...4f2E', isCurrentUser: true },
  ],
  race_005: [
    { id: '1', creatureName: 'All-Rounder', creatureRarity: 'legendary', ownerAddress: '0x3a4B...8c2D', isCurrentUser: false },
    { id: '2', creatureName: 'Jack of Trades', creatureRarity: 'epic', ownerAddress: '0x6c1D...3e4F', isCurrentUser: false },
    { id: '3', creatureName: 'Versatile Vex', creatureRarity: 'mythic', ownerAddress: '0x2b5A...9d2C', isCurrentUser: false },
    { id: '4', creatureName: 'Multi Talent', creatureRarity: 'legendary', ownerAddress: '0x8f3E...4a1B', isCurrentUser: false },
    { id: '5', creatureName: 'Balanced Beast', creatureRarity: 'epic', ownerAddress: '0x5c2D...7b4A', isCurrentUser: false },
    { id: '6', creatureName: 'Mixed Master', creatureRarity: 'rare', ownerAddress: '0x1a4C...6e3F', isCurrentUser: false },
    { id: '7', creatureName: 'Grand Mixer', creatureRarity: 'legendary', ownerAddress: '0x4d5B...2c1A', isCurrentUser: false },
  ],
};

const typeColors: Record<RaceType, { bg: string; text: string }> = {
  sprint: { bg: 'bg-race-sprint/20', text: 'text-race-sprint' },
  distance: { bg: 'bg-race-distance/20', text: 'text-race-distance' },
  technical: { bg: 'bg-race-technical/20', text: 'text-race-technical' },
  mixed: { bg: 'bg-race-mixed/20', text: 'text-race-mixed' },
  hazard: { bg: 'bg-race-hazard/20', text: 'text-race-hazard' },
};

const typeLabels: Record<RaceType, string> = {
  sprint: 'Sprint',
  distance: 'Distance',
  technical: 'Technical',
  mixed: 'Mixed',
  hazard: 'Hazard',
};

const rarityStyles: Record<Rarity, string> = {
  common: 'text-muted-foreground',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
  mythic: 'text-rarity-mythic',
  cyberium: 'text-rarity-mythic',
};

interface RaceDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  race: Race | null;
  onEnter: (race: Race) => void;
}

export function RaceDetailsModal({ open, onOpenChange, race, onEnter }: RaceDetailsModalProps) {
  if (!race) return null;

  const typeStyle = typeColors[race.raceType];
  const entrants = mockEntrants[race.id] || [];
  const isFull = race.entryCount >= race.maxEntries;
  const isOpen = race.status === 'open' && !isFull;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cyber-card border-primary/30 max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="font-display text-xl text-foreground">
                {race.name}
              </DialogTitle>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider mt-2',
                typeStyle.bg,
                typeStyle.text
              )}>
                {typeLabels[race.raceType]}
              </span>
            </div>
            {race.status === 'running' && (
              <span className="px-2 py-1 rounded bg-secondary/20 text-secondary text-xs font-mono animate-pulse">
                In Progress
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Race Info */}
        <div className="grid grid-cols-3 gap-4 py-4 border-b border-border/50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Entries</span>
            </div>
            <p className="font-mono text-foreground">
              {race.entryCount}/{race.maxEntries}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Deadline</span>
            </div>
            <p className="font-mono text-foreground">
              {formatCountdown(race.entryDeadline)}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Coins className="w-3.5 h-3.5 text-race-sprint" />
              <span>Entry</span>
            </div>
            <p className="font-mono text-foreground">
              {race.entryFee} <span className="text-muted-foreground text-xs">credits</span>
            </p>
          </div>
        </div>

        {/* Entrants List */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Competitors ({entrants.length})
            </h3>
          </div>
          
          {entrants.length > 0 ? (
            <div className="space-y-2">
              {entrants.map((entrant, index) => (
                <div
                  key={entrant.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-colors',
                    entrant.isCurrentUser
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-muted/30 border-border/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-xs font-mono text-muted-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <p className={cn(
                        'font-medium text-sm',
                        entrant.isCurrentUser ? 'text-primary' : 'text-foreground'
                      )}>
                        {entrant.creatureName}
                        {entrant.isCurrentUser && (
                          <span className="ml-2 text-[10px] text-primary/70">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {entrant.ownerAddress}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    rarityStyles[entrant.creatureRarity]
                  )}>
                    {entrant.creatureRarity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No entrants yet. Be the first to enter!
            </div>
          )}
        </div>

        {/* Enter Button */}
        {isOpen && (
          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={() => {
                onOpenChange(false);
                onEnter(race);
              }}
              className="w-full bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30"
              variant="outline"
            >
              Enter Race
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

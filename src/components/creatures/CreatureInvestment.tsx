import { Flame, Trophy } from 'lucide-react';
import { CreatureWithStats, WalletLedger } from '@/types/game';

interface CreatureInvestmentProps {
  creature: CreatureWithStats;
  ledger: WalletLedger | null;
}

export function CreatureInvestment({ creature, ledger }: CreatureInvestmentProps) {
  if (!ledger) return null;

  // Find this creature's spending from the per-creature breakdown
  const spending = ledger.creatureSpending?.find(s => s.creatureId === creature.id);
  if (!spending || spending.spentNanoerg === 0) return null;

  // Count training vs race entries for this creature from ledger entries
  const creatureEntries = ledger.entries.filter(e => e.creatureId === creature.id);
  const trainingEntries = creatureEntries.filter(e => e.txType === 'training_fee');
  const raceEntries = creatureEntries.filter(e => e.txType === 'race_entry_fee');

  const trainingSpent = Math.abs(
    trainingEntries.reduce((sum, e) => sum + e.amountNanoerg, 0)
  ) / 1_000_000_000;
  const raceSpent = Math.abs(
    raceEntries.reduce((sum, e) => sum + e.amountNanoerg, 0)
  ) / 1_000_000_000;

  const { prestige } = creature;
  const record = `${prestige.lifetimeWins}W-${prestige.lifetimePlaces}P-${prestige.lifetimeShows}S`;

  return (
    <div className="cyber-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-destructive" />
        <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Investment
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-2 rounded-lg bg-muted/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Training
          </p>
          <p className="font-mono text-sm font-bold text-foreground">
            {trainingSpent.toFixed(2)} ERG
          </p>
          <p className="text-[10px] text-muted-foreground">
            {trainingEntries.length} session{trainingEntries.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="p-2 rounded-lg bg-muted/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Race Entries
          </p>
          <p className="font-mono text-sm font-bold text-foreground">
            {raceSpent.toFixed(2)} ERG
          </p>
          <p className="text-[10px] text-muted-foreground">
            {raceEntries.length} race{raceEntries.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Total:</span>
          <span className="font-mono text-sm font-semibold text-foreground">
            {spending.spentErg.toFixed(2)} ERG
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-3 h-3 text-accent" />
          <span className="text-xs font-mono text-accent">{record}</span>
        </div>
      </div>
    </div>
  );
}

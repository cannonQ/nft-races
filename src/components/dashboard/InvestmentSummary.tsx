import { Link } from 'react-router-dom';
import { Flame, Trophy, ArrowRight } from 'lucide-react';
import { useWalletLedger, useSeasons } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { Skeleton } from '@/components/ui/skeleton';

export function InvestmentSummary() {
  const { address } = useWallet();
  const { data: ledger, loading } = useWalletLedger(address);
  const { data: seasons } = useSeasons();
  const totalPrizePool = (seasons ?? []).reduce((sum, s) => sum + (s.prizePool ?? 0), 0);

  if (!address || loading) {
    if (loading) return <Skeleton className="h-16 rounded-xl mb-4" />;
    return null;
  }

  // Don't show if no ledger activity yet
  if (!ledger || (ledger.totalSpent === 0 && ledger.totalEarned === 0)) return null;

  return (
    <Link
      to="/wallet"
      className="cyber-card rounded-xl p-4 mb-4 flex items-center justify-between group hover:ring-1 hover:ring-primary/30 transition-all"
    >
      <div className="flex items-center gap-6">
        {/* Invested */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Flame className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-foreground">
              {ledger.totalSpentErg.toFixed(2)} ERG
            </p>
            <p className="text-[10px] text-muted-foreground">
              {ledger.trainingCount} session{ledger.trainingCount !== 1 ? 's' : ''}
              {ledger.racesEntered > 0 && ` · ${ledger.racesEntered} race${ledger.racesEntered !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="h-8 w-px bg-border hidden sm:block" />

        {/* Prize Pool */}
        <div className="flex items-center gap-2 hidden sm:flex">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-accent">
              {(totalPrizePool || ledger.seasonPrizePoolErg).toFixed(2)} ERG
            </p>
            <p className="text-[10px] text-muted-foreground">Prize Pool</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
        <span className="hidden sm:inline">Details</span>
        <ArrowRight className="w-4 h-4" />
      </div>
    </Link>
  );
}

import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, Trophy, Flag } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWalletLedger } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { cn } from '@/lib/utils';

export default function WalletLedger() {
  const { address } = useWallet();
  const { data: ledger, loading } = useWalletLedger(address);

  if (!address) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="cyber-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">Connect your wallet to view your ledger.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  const hasActivity = ledger && (ledger.totalSpent > 0 || ledger.totalEarned > 0);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Season Ledger
            </h1>
            <p className="text-sm text-muted-foreground">
              Your investment and earnings this season
            </p>
          </div>
        </div>

        {!hasActivity ? (
          <div className="cyber-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No activity yet this season. Train or enter a race to get started.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="cyber-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-4 h-4 text-destructive" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Burned</span>
                </div>
                <p className="font-mono text-2xl font-bold text-foreground">
                  {ledger!.totalSpentErg.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ERG invested</p>
              </div>

              <div className="cyber-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-accent" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Prize Pool</span>
                </div>
                <p className="font-mono text-2xl font-bold text-accent">
                  {ledger!.seasonPrizePoolErg.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ERG up for grabs</p>
              </div>

              <div className="cyber-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Activity</span>
                </div>
                <p className="font-mono text-2xl font-bold text-foreground">
                  {ledger!.trainingCount + ledger!.racesEntered}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ledger!.trainingCount} training · {ledger!.racesEntered} races
                </p>
              </div>
            </div>

            {/* Transaction History */}
            <div className="cyber-card rounded-xl p-4">
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-4">
                Transaction History
              </h2>
              <div className="space-y-1">
                {ledger!.entries.map((entry) => {
                  const isDebit = entry.amountNanoerg < 0;
                  const date = new Date(entry.createdAt);
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-muted-foreground font-mono shrink-0 w-16">
                          {dateStr}
                        </span>
                        <span className="text-sm text-foreground truncate">
                          {entry.memo || entry.txType}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'font-mono text-sm font-semibold shrink-0 ml-4',
                          isDebit ? 'text-destructive' : 'text-accent'
                        )}
                      >
                        {isDebit ? '' : '+'}{entry.amountErg.toFixed(2)} ERG
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

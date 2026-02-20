import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, Trophy, Flag, ExternalLink } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CollectionFilter } from '@/components/ui/CollectionFilter';
import { PetImage } from '@/components/creatures/PetImage';
import { useWalletLedger, useCollections } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { useCollectionFilter } from '@/hooks/useCollectionFilter';
import { cn } from '@/lib/utils';

const EXPLORER_TX_URL = 'https://ergexplorer.com/transactions#';

export default function WalletLedger() {
  const { address } = useWallet();
  const { data: ledger, loading } = useWalletLedger(address);
  const { data: collections } = useCollections();
  const { active: activeCollections, toggle: toggleCollection, matches: matchesCollection } = useCollectionFilter();

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

  // Derive filtered stats from entries when a collection filter is active
  const filteredEntries = ledger?.entries.filter((e) => matchesCollection(e.collectionId ?? undefined)) ?? [];
  const isFiltered = activeCollections.size > 0;

  const filteredSpentErg = isFiltered
    ? filteredEntries.filter((e) => e.amountNanoerg < 0).reduce((sum, e) => sum + Math.abs(e.amountErg), 0)
    : ledger?.totalSpentErg ?? 0;

  const filteredPrizePoolErg = isFiltered
    ? (ledger?.prizePools ?? []).filter((p) => activeCollections.has(p.collectionId)).reduce((sum, p) => sum + p.prizePoolErg, 0)
    : ledger?.seasonPrizePoolErg ?? 0;

  const filteredTraining = isFiltered
    ? filteredEntries.filter((e) => e.txType === 'training_fee').length
    : ledger?.trainingCount ?? 0;
  const filteredRaces = isFiltered
    ? filteredEntries.filter((e) => e.txType === 'race_entry_fee').length
    : ledger?.racesEntered ?? 0;

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

        <CollectionFilter
          collections={collections || []}
          active={activeCollections}
          onToggle={toggleCollection}
        />

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
                  {filteredSpentErg.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ERG invested</p>
              </div>

              <div className="cyber-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-accent" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Prize Pool</span>
                </div>
                <p className="font-mono text-2xl font-bold text-accent">
                  {filteredPrizePoolErg.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ERG up for grabs</p>
              </div>

              <div className="cyber-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Activity</span>
                </div>
                <p className="font-mono text-2xl font-bold text-foreground">
                  {filteredTraining + filteredRaces}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filteredTraining} training · {filteredRaces} races
                </p>
              </div>
            </div>

            {/* Transaction History */}
            <div className="cyber-card rounded-xl p-4">
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-4">
                Transaction History
              </h2>
              <div className="space-y-1">
                {filteredEntries.map((entry) => {
                  const isDebit = entry.amountNanoerg < 0;
                  const date = new Date(entry.createdAt);
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-muted-foreground font-mono shrink-0 w-16">
                          {dateStr}
                        </span>
                        {(entry.creatureImageUrl || entry.creatureFallbackImageUrl) && (
                          <PetImage
                            src={entry.creatureImageUrl ?? undefined}
                            fallbackSrc={entry.creatureFallbackImageUrl ?? undefined}
                            alt={entry.creatureName ?? ''}
                            className="w-6 h-6 rounded shrink-0"
                          />
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm text-foreground truncate">
                            {entry.memo || entry.txType}
                          </span>
                          {entry.creatureName && (
                            <span className="text-xs text-muted-foreground truncate">
                              {entry.creatureName}
                            </span>
                          )}
                        </div>
                        {entry.raceName && entry.raceId && (
                          <Link
                            to={`/races/${entry.raceId}/results`}
                            className="text-[10px] text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded shrink-0 transition-colors"
                          >
                            {entry.raceName}
                          </Link>
                        )}
                        {entry.seasonName && (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded shrink-0">
                            {entry.seasonName}
                          </span>
                        )}
                        {entry.collectionName && (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded shrink-0">
                            {entry.collectionName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <span
                          className={cn(
                            'font-mono text-sm font-semibold',
                            isDebit ? 'text-destructive' : 'text-accent'
                          )}
                        >
                          {entry.feeTokenAmount
                            ? `${isDebit ? '-' : '+'}${entry.feeTokenAmount} ${entry.feeTokenName ?? 'TOKEN'}`
                            : `${isDebit ? '' : '+'}${entry.amountErg.toFixed(2)} ERG`
                          }
                        </span>
                        {entry.txId ? (
                          <a
                            href={`${EXPLORER_TX_URL}${entry.txId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent/60 hover:text-accent transition-colors"
                            title="View on Ergo Explorer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="w-3.5" />
                        )}
                      </div>
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

import { useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trophy, AlertCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RaceCard } from '@/components/races/RaceCard';
import { RaceEntryModal } from '@/components/races/RaceEntryModal';
import { RaceEntryResultModal } from '@/components/races/RaceEntryResultModal';
import { RaceDetailsModal } from '@/components/races/RaceDetailsModal';
import { CollectionFilter } from '@/components/ui/CollectionFilter';
import { useRaces, useEnterRace, useEnterRaceBatch, useCollections, useGameConfig, useCreaturesByWallet } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { useCollectionFilter } from '@/hooks/useCollectionFilter';
import { Race, PaymentCurrency } from '@/types/game';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ErgoPayTxModal } from '@/components/ergopay/ErgoPayTxModal';
import { requestErgoPayTx, type ErgoPayTxRequest } from '@/lib/ergo/ergopay-tx';
import { buildAndSubmitBatchEntryFeeTx, buildAndSubmitBatchTokenFeeTx } from '@/lib/ergo/transactions';

export default function Races() {
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [isEntering, setIsEntering] = useState(false);
  const { address, walletType } = useWallet();
  const { data: races, loading, refetch: refetchRaces } = useRaces();
  const { data: collections } = useCollections();
  const { data: gameConfig } = useGameConfig(selectedRace?.collectionId);
  const enterRace = useEnterRace();
  const enterRaceBatch = useEnterRaceBatch();
  const { data: creatures } = useCreaturesByWallet(address);
  const { active: activeCollections, toggle: toggleCollection, matches: matchesCollection } = useCollectionFilter();
  const [searchParams, setSearchParams] = useSearchParams();
  const raceView = (searchParams.get('view') as 'all' | 'open' | 'completed') || 'all';
  const setRaceView = (view: 'all' | 'open' | 'completed') => {
    if (view === 'all') {
      searchParams.delete('view');
    } else {
      searchParams.set('view', view);
    }
    setSearchParams(searchParams, { replace: true });
  };
  // Entry result modal state
  const [showResultModal, setShowResultModal] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [lastEnteredCount, setLastEnteredCount] = useState(0);
  const [lastPaymentCurrency, setLastPaymentCurrency] = useState<PaymentCurrency | undefined>(undefined);
  // ErgoPay payment state
  const [ergoPayTx, setErgoPayTx] = useState<ErgoPayTxRequest | null>(null);
  const [showErgoPayModal, setShowErgoPayModal] = useState(false);

  const requireFees = gameConfig?.requireFees ?? false;
  const treasuryErgoTree = gameConfig?.treasuryErgoTree ?? '';
  const feeToken = gameConfig?.feeToken ?? null;

  const openRaces = useMemo(() => (races?.filter(r => r.status === 'open' && matchesCollection(r.collectionId)) || []), [races, matchesCollection]);
  const runningRaces = useMemo(() => (races?.filter(r => r.status === 'running' && matchesCollection(r.collectionId)) || []), [races, matchesCollection]);
  const resolvedRaces = useMemo(() => (races?.filter(r => (r.status === 'resolved' || r.status === 'locked') && matchesCollection(r.collectionId)) || []), [races, matchesCollection]);

  const handleRaceExpired = useCallback((_race: Race) => {
    // Small delay to let server-side resolution complete
    setTimeout(() => {
      refetchRaces();
    }, 2000);
  }, [refetchRaces]);

  const handleEnterRace = (race: Race) => {
    setSelectedRace(race);
    setShowEntryModal(true);
  };

  const handleViewDetails = (race: Race) => {
    setSelectedRace(race);
    setShowDetailsModal(true);
  };

  const handleConfirmEntry = async (creatureIds: string[], paymentCurrency?: PaymentCurrency) => {
    if (!selectedRace || !address || creatureIds.length === 0) return;
    // Keep entry modal open — it shows "Signing..." while Nautilus is up.
    setEntryError(null);
    setIsEntering(true);

    try {
      if (!requireFees) {
        // Alpha mode: no fees — batch endpoint, no txId
        const result = await enterRaceBatch.mutate(selectedRace.id, creatureIds, address);
        setLastTxId(null);
        setLastPaymentCurrency(undefined);
        setLastEnteredCount(result.entries.length);
        if (result.errors && result.errors.length > 0) {
          setEntryError(`${result.errors.length} failed: ${result.errors[0].error}`);
        }
      } else if (walletType === 'nautilus') {
        let txId: string;
        const entryFeeNanoerg = Math.round((selectedRace.entryFee ?? 0) * 1_000_000_000);
        const entryFeeToken = selectedRace.entryFeeToken ?? feeToken?.default_race_entry_fee ?? null;

        if (paymentCurrency === 'token' && feeToken && entryFeeToken) {
          // Token payment via Babel box
          const entries = creatureIds.map(creatureId => ({
            feeTokenId: feeToken.token_id,
            feeTokenAmount: BigInt(entryFeeToken) * BigInt(10 ** feeToken.decimals),
            metadata: {
              actionType: 'race',
              tokenId: (creatures || []).find(c => c.id === creatureId)?.tokenId ?? '',
              context: selectedRace.id,
            },
          }));
          txId = await buildAndSubmitBatchTokenFeeTx(entries, treasuryErgoTree);
        } else {
          // ERG payment
          const entries = creatureIds.map(creatureId => ({
            entryFeeNanoErgs: entryFeeNanoerg,
            metadata: {
              actionType: 'race',
              tokenId: (creatures || []).find(c => c.id === creatureId)?.tokenId ?? '',
              context: selectedRace.id,
            },
          }));
          txId = await buildAndSubmitBatchEntryFeeTx(entries, treasuryErgoTree);
        }

        const result = await enterRaceBatch.mutate(selectedRace.id, creatureIds, address, txId, paymentCurrency);
        setLastTxId(txId);
        setLastPaymentCurrency(paymentCurrency);
        setLastEnteredCount(result.entries.length);
        if (result.errors && result.errors.length > 0) {
          setEntryError(`${result.errors.length} failed: ${result.errors[0].error}`);
        }
      } else if (walletType === 'ergopay') {
        // ErgoPay: batch — single payment request covering all creatures
        setShowEntryModal(false);
        const txReq = await requestErgoPayTx({
          actionType: 'race_entry_fee',
          walletAddress: address,
          creatureIds,
          raceId: selectedRace.id,
          paymentCurrency,
        });
        setErgoPayTx(txReq);
        setShowErgoPayModal(true);
        setIsEntering(false);
        setLastEnteredCount(creatureIds.length);
        return; // ErgoPay modal handles the rest
      }

      // Close entry modal and show result
      setShowEntryModal(false);
      setIsEntering(false);
      setShowResultModal(true);
    } catch (err) {
      setEntryError(err instanceof Error ? err.message : 'Failed to enter race');
      setShowEntryModal(false);
      setIsEntering(false);
      refetchRaces();
      setSelectedRace(null);
    }
  };

  const handleErgoPayEntrySuccess = useCallback((_result: any, txId: string) => {
    setShowErgoPayModal(false);
    setLastPaymentCurrency(ergoPayTx?.tokenAmount != null ? 'token' : 'erg');
    setErgoPayTx(null);
    setLastTxId(txId || null);
    // lastEnteredCount already set when ErgoPay flow started
    setShowResultModal(true);
  }, [ergoPayTx]);

  const handleErgoPayEntryExpired = useCallback(() => {
    setShowErgoPayModal(false);
    setErgoPayTx(null);
    setEntryError('Payment expired. Please try again.');
  }, []);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Race Lobby
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enter races and compete for glory
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CollectionFilter
            collections={collections || []}
            active={activeCollections}
            onToggle={toggleCollection}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mr-1">Status:</span>
            {(['all', 'open', 'completed'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setRaceView(view)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 border capitalize',
                  raceView === view
                    ? 'bg-primary/20 text-primary border-primary/50'
                    : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/30'
                )}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {entryError && (
          <div className="cyber-card rounded-lg p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{entryError}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Running Races */}
            {raceView !== 'completed' && runningRaces.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-semibold text-secondary mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  Races in Progress
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {runningRaces.map((race, index) => (
                    <div
                      key={race.id}
                      className="animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <RaceCard race={race} onEnter={handleEnterRace} onViewDetails={handleViewDetails} feeToken={feeToken} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Open Races */}
            {raceView !== 'completed' && <section>
              <h2 className="font-display text-lg font-semibold text-foreground mb-4">
                Open for Entry
              </h2>
              {openRaces.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {openRaces.map((race, index) => (
                    <div
                      key={race.id}
                      className="animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <RaceCard race={race} onEnter={handleEnterRace} onViewDetails={handleViewDetails} feeToken={feeToken} onExpired={handleRaceExpired} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cyber-card rounded-xl p-8 text-center">
                  <p className="text-muted-foreground">No races currently open for entry.</p>
                </div>
              )}
            </section>}
          </>
        )}

        {/* Recent Results */}
        {raceView === 'completed' && resolvedRaces.length === 0 && !loading && (
          <div className="cyber-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No completed races yet.</p>
          </div>
        )}
        {raceView !== 'open' && resolvedRaces.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-race-sprint" />
              Recent Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {resolvedRaces.map((race, index) => (
                <div
                  key={race.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <Link to={`/races/${race.id}/results`}>
                    <Card className="cyber-card group hover:border-primary/50 transition-all duration-200 overflow-hidden">
                      <CardContent className="p-4">
                        <h4 className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors text-center truncate">
                          {race.name}
                        </h4>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                            'bg-muted text-muted-foreground'
                          )}>
                            {race.raceType}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {race.entryCount} entries
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Details Modal */}
        <RaceDetailsModal
          open={showDetailsModal}
          onOpenChange={setShowDetailsModal}
          race={selectedRace}
          onEnter={handleEnterRace}
        />

        {/* Entry Modal */}
        <RaceEntryModal
          open={showEntryModal}
          onOpenChange={setShowEntryModal}
          race={selectedRace}
          onConfirm={handleConfirmEntry}
          requireFees={requireFees}
          walletType={walletType}
          submitting={isEntering}
          feeToken={feeToken}
        />

        {/* Entry Result Modal */}
        <RaceEntryResultModal
          open={showResultModal}
          onOpenChange={(open) => {
            setShowResultModal(open);
            if (!open) {
              setSelectedRace(null);
              setLastTxId(null);
              setLastPaymentCurrency(undefined);
              refetchRaces();
            }
          }}
          race={selectedRace}
          enteredCount={lastEnteredCount}
          txId={lastTxId}
          feeErg={requireFees && lastPaymentCurrency !== 'token' && selectedRace ? Math.round(selectedRace.entryFee * lastEnteredCount * 1e8) / 1e8 : undefined}
          feeTokenName={lastPaymentCurrency === 'token' && feeToken ? feeToken.name : undefined}
          feeTokenAmount={lastPaymentCurrency === 'token' && feeToken && selectedRace
            ? (selectedRace.entryFeeToken ?? feeToken.default_race_entry_fee ?? 0) * lastEnteredCount
            : undefined
          }
        />

        {ergoPayTx && (
          <ErgoPayTxModal
            open={showErgoPayModal}
            onOpenChange={setShowErgoPayModal}
            ergoPayUrl={ergoPayTx.ergoPayUrl}
            requestId={ergoPayTx.requestId}
            amount={ergoPayTx.amount}
            description="Race entry fee payment"
            onSuccess={handleErgoPayEntrySuccess}
            onExpired={handleErgoPayEntryExpired}
            tokenAmount={ergoPayTx.tokenAmount}
            tokenName={ergoPayTx.tokenName}
          />
        )}
      </div>
    </MainLayout>
  );
}

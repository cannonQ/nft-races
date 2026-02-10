import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Calendar, AlertCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RaceCard } from '@/components/races/RaceCard';
import { RaceEntryModal } from '@/components/races/RaceEntryModal';
import { RaceDetailsModal } from '@/components/races/RaceDetailsModal';
import { useRaces, useEnterRace } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { Race } from '@/types/game';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function Races() {
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [isEntering, setIsEntering] = useState(false);
  const { toast } = useToast();
  const { address } = useWallet();
  const { data: races, loading, refetch: refetchRaces } = useRaces();
  const enterRace = useEnterRace();

  const openRaces = races?.filter(r => r.status === 'open') || [];
  const runningRaces = races?.filter(r => r.status === 'running') || [];
  const resolvedRaces = races?.filter(r => r.status === 'resolved' || r.status === 'locked') || [];

  const handleEnterRace = (race: Race) => {
    setSelectedRace(race);
    setShowEntryModal(true);
  };

  const handleViewDetails = (race: Race) => {
    setSelectedRace(race);
    setShowDetailsModal(true);
  };

  const handleConfirmEntry = async (creatureIds: string[]) => {
    if (!selectedRace || !address || creatureIds.length === 0) return;
    setShowEntryModal(false);
    setEntryError(null);
    setIsEntering(true);

    let entered = 0;
    const errors: string[] = [];

    for (const creatureId of creatureIds) {
      try {
        await enterRace.mutate(selectedRace.id, creatureId, address);
        entered++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Failed to enter race');
      }
    }

    if (entered > 0) {
      toast({
        title: "Entry Confirmed!",
        description: `${entered} creature${entered > 1 ? 's' : ''} entered into ${selectedRace.name}`,
      });
    }
    if (errors.length > 0) {
      setEntryError(`${errors.length} failed: ${errors[0]}`);
    }

    refetchRaces();
    setIsEntering(false);
    setSelectedRace(null);
  };

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

        {entryError && (
          <div className="cyber-card rounded-lg p-4 border-destructive/30 bg-destructive/5">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{entryError}</p>
            </div>
          </div>
        )}

        {isEntering && (
          <div className="cyber-card rounded-lg p-4 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-primary">Entering race...</p>
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
            {runningRaces.length > 0 && (
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
                      <RaceCard race={race} onEnter={handleEnterRace} onViewDetails={handleViewDetails} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Open Races */}
            <section>
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
                      <RaceCard race={race} onEnter={handleEnterRace} onViewDetails={handleViewDetails} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cyber-card rounded-xl p-8 text-center">
                  <p className="text-muted-foreground">No races currently open for entry.</p>
                </div>
              )}
            </section>
          </>
        )}

        {/* Recent Results */}
        {resolvedRaces.length > 0 && (
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
        />
      </div>
    </MainLayout>
  );
}

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RaceCard } from '@/components/races/RaceCard';
import { RaceEntryModal } from '@/components/races/RaceEntryModal';
import { RaceDetailsModal } from '@/components/races/RaceDetailsModal';
import { useRaces } from '@/api';
import { Race } from '@/types/game';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function Races() {
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { toast } = useToast();
  const { data: races, loading } = useRaces();

  const openRaces = races?.filter(r => r.status === 'open') || [];
  const runningRaces = races?.filter(r => r.status === 'running') || [];

  const handleEnterRace = (race: Race) => {
    setSelectedRace(race);
    setShowEntryModal(true);
  };

  const handleViewDetails = (race: Race) => {
    setSelectedRace(race);
    setShowDetailsModal(true);
  };

  const handleConfirmEntry = (creatureId: string) => {
    setShowEntryModal(false);
    toast({
      title: "Entry Confirmed!",
      description: `Your creature has been entered into ${selectedRace?.name}`,
    });
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

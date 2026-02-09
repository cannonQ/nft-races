import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Calendar } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RaceCard } from '@/components/races/RaceCard';
import { RaceEntryModal } from '@/components/races/RaceEntryModal';
import { RaceDetailsModal } from '@/components/races/RaceDetailsModal';
import { useRaces } from '@/api';
import { Race } from '@/types/game';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function Races() {
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const { toast } = useToast();
  const { data: races, loading } = useRaces();

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

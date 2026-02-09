import { Link } from 'react-router-dom';
import { Trophy, Medal, Award } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLeaderboard, useRaces } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export default function Leaderboard() {
  const { data: leaderboard, loading } = useLeaderboard();
  const { data: races } = useRaces();
  const { address } = useWallet();

  const resolvedRaces = races?.filter(r => r.status === 'resolved' || r.status === 'locked') || [];

  const isUserCreature = (ownerAddress: string) => ownerAddress === address;

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Season rankings and race history
          </p>
        </div>

        {/* Season Leaders */}
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-race-sprint" />
            Season Leaders
          </h2>
          <div className="cyber-card rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 md:gap-4 items-center p-3 bg-muted/50 border-b border-border/50 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-4 md:col-span-3">Creature</div>
              <div className="col-span-3 hidden md:block">Owner</div>
              <div className="col-span-2 text-center">W/P/S</div>
              <div className="col-span-4 md:col-span-3 text-right">Races</div>
            </div>

            {/* Rows */}
            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {(leaderboard || []).map((entry) => {
                  const isUser = isUserCreature(entry.ownerAddress);
                  return (
                    <div
                      key={entry.rank}
                      className={cn(
                        'grid grid-cols-12 gap-2 md:gap-4 items-center p-3 transition-colors',
                        isUser ? 'bg-primary/10' : 'hover:bg-muted/30'
                      )}
                    >
                      {/* Rank */}
                      <div className="col-span-1 text-center">
                        {entry.rank === 1 && <Trophy className="w-5 h-5 text-race-sprint mx-auto" />}
                        {entry.rank === 2 && <Medal className="w-5 h-5 text-muted-foreground mx-auto" />}
                        {entry.rank === 3 && <Award className="w-5 h-5 text-race-hazard mx-auto" />}
                        {entry.rank > 3 && (
                          <span className="font-mono text-sm text-foreground">{entry.rank}</span>
                        )}
                      </div>

                      {/* Creature */}
                      <div className="col-span-4 md:col-span-3">
                        <Link to={`/creatures/${entry.creatureId}`} className="block">
                          <p className={cn(
                            'font-medium text-sm truncate hover:underline cursor-pointer',
                            isUser ? 'text-primary' : 'text-foreground'
                          )}>
                            {entry.creatureName}
                            {isUser && <span className="ml-1 text-[10px] text-primary/70">(You)</span>}
                          </p>
                        </Link>
                      </div>

                      {/* Owner */}
                      <div className="col-span-3 hidden md:block">
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {entry.ownerAddress}
                        </p>
                      </div>

                      {/* W/P/S */}
                      <div className="col-span-2 text-center">
                        <span className="font-mono text-sm text-foreground">
                          {entry.wins}/{entry.places}/{entry.shows}
                        </span>
                      </div>

                      {/* Races */}
                      <div className="col-span-4 md:col-span-3 text-right">
                        <span className="font-mono text-sm text-foreground">
                          {entry.racesEntered}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Past Race Results */}
        {resolvedRaces.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">
              Recent Race Results
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">
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
      </div>
    </MainLayout>
  );
}

import { Trophy, Medal, Award } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PastRaceItem, mockPastRaces } from '@/components/races/PastRaceItem';
import { useLeaderboard } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Leaderboard() {
  const { data: leaderboard, loading } = useLeaderboard();
  const { address } = useWallet();

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
              <div className="col-span-4 md:col-span-3 text-right">Earnings</div>
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
                        <p className={cn(
                          'font-medium text-sm truncate',
                          isUser ? 'text-primary' : 'text-foreground'
                        )}>
                          {entry.creatureName}
                          {isUser && <span className="ml-1 text-[10px] text-primary/70">(You)</span>}
                        </p>
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

                      {/* Earnings */}
                      <div className="col-span-4 md:col-span-3 text-right">
                        <span className="font-mono text-sm font-semibold text-secondary">
                          +{entry.earnings.toLocaleString()}
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
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">
            Recent Race Results
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {mockPastRaces.map((race, index) => (
              <div
                key={race.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <PastRaceItem race={race} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

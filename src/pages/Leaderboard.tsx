import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Medal, Award } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { CollectionFilter } from '@/components/ui/CollectionFilter';
import { useLeaderboard, useRaces, useCollections, useSeasons } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { useCollectionFilter } from '@/hooks/useCollectionFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { RarityBadge } from '@/components/creatures/StatBar';
import { PetImage } from '@/components/creatures/PetImage';

function truncateAddress(addr: string): string {
  if (addr.length <= 15) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

export default function Leaderboard() {
  const { data: collections } = useCollections();
  const { data: seasons } = useSeasons();
  const { active: activeCollections, toggle: toggleCollection } = useCollectionFilter();
  const { address } = useWallet();

  // Resolve the season for the leaderboard based on selected collection filter
  const selectedSeasonId = useMemo(() => {
    if (!seasons || seasons.length === 0) return undefined;
    if (activeCollections.size === 1) {
      const collectionId = [...activeCollections][0];
      const season = seasons.find(s => s.collectionId === collectionId);
      return season?.id;
    }
    return undefined;
  }, [seasons, activeCollections]);

  const { data: leaderboard, loading } = useLeaderboard(selectedSeasonId);
  const { data: races } = useRaces();

  const resolvedRaces = useMemo(() => {
    const filtered = races?.filter(r => r.status === 'resolved' || r.status === 'locked') || [];
    if (activeCollections.size === 0) return filtered;
    return filtered.filter(r => r.collectionId && activeCollections.has(r.collectionId));
  }, [races, activeCollections]);

  const isUserCreature = (ownerAddress: string) => ownerAddress === address;

  const leaderboardTitle = useMemo(() => {
    if (activeCollections.size === 1 && collections) {
      const col = collections.find(c => activeCollections.has(c.id));
      if (col) return `${col.name} Season Leaders`;
    }
    return 'Season Leaders';
  }, [activeCollections, collections]);

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

        <CollectionFilter
          collections={collections || []}
          active={activeCollections}
          onToggle={toggleCollection}
        />

        {/* Season Leaders */}
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-race-sprint" />
            {leaderboardTitle}
          </h2>
          <div className="cyber-card rounded-xl overflow-hidden overflow-x-auto">
            {/* Desktop Header */}
            <div className="hidden md:grid grid-cols-[3rem_2.5rem_1fr_5rem_8rem_5rem_5rem_3.5rem] gap-3 items-center p-3 bg-muted/50 border-b border-border/50 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <div className="text-center">Rank</div>
              <div></div>
              <div>Creature</div>
              <div>Rarity</div>
              <div>Owner</div>
              <div className="text-center">W/P/S</div>
              <div className="text-center">Avg</div>
              <div className="text-right">Races</div>
            </div>

            {/* Mobile Header */}
            <div className="grid md:hidden grid-cols-[2.5rem_2rem_1fr_4.5rem_3rem] gap-2 items-center p-3 bg-muted/50 border-b border-border/50 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <div className="text-center">#</div>
              <div></div>
              <div>Creature</div>
              <div className="text-center">W/P/S</div>
              <div className="text-right">Races</div>
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
                    <div key={entry.rank}>
                      {/* Desktop Row */}
                      <div
                        className={cn(
                          'hidden md:grid grid-cols-[3rem_2.5rem_1fr_5rem_8rem_5rem_5rem_3.5rem] gap-3 items-center p-3 transition-colors',
                          isUser ? 'bg-primary/10' : 'hover:bg-muted/30'
                        )}
                      >
                        <div className="text-center">
                          {entry.rank === 1 && <Trophy className="w-5 h-5 text-race-sprint mx-auto" />}
                          {entry.rank === 2 && <Medal className="w-5 h-5 text-muted-foreground mx-auto" />}
                          {entry.rank === 3 && <Award className="w-5 h-5 text-race-hazard mx-auto" />}
                          {entry.rank > 3 && (
                            <span className="font-mono text-sm text-foreground">{entry.rank}</span>
                          )}
                        </div>

                        <div>
                          {entry.imageUrl || entry.fallbackImageUrl ? (
                            <PetImage
                              src={entry.imageUrl}
                              fallbackSrc={entry.fallbackImageUrl}
                              alt={entry.creatureName}
                              className="w-8 h-8 rounded-md"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-muted/50" />
                          )}
                        </div>

                        <div>
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

                        <div>
                          <RarityBadge rarity={entry.rarity} />
                        </div>

                        <div>
                          {entry.ownerDisplayName ? (
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.ownerDisplayName}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground font-mono">
                              {truncateAddress(entry.ownerAddress)}
                            </p>
                          )}
                        </div>

                        <div className="text-center">
                          <span className="font-mono text-sm text-foreground">
                            {entry.wins}/{entry.places}/{entry.shows}
                          </span>
                        </div>

                        <div className="text-center">
                          <span className="font-mono text-sm text-foreground">
                            {entry.avgScore > 0 ? entry.avgScore.toFixed(1) : '-'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-sm text-foreground">
                            {entry.racesEntered}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Row */}
                      <div
                        className={cn(
                          'grid md:hidden grid-cols-[2.5rem_2rem_1fr_4.5rem_3rem] gap-2 items-center p-3 transition-colors',
                          isUser ? 'bg-primary/10' : 'hover:bg-muted/30'
                        )}
                      >
                        <div className="text-center">
                          {entry.rank <= 3 ? (
                            entry.rank === 1 ? <Trophy className="w-4 h-4 text-race-sprint mx-auto" /> :
                            entry.rank === 2 ? <Medal className="w-4 h-4 text-muted-foreground mx-auto" /> :
                            <Award className="w-4 h-4 text-race-hazard mx-auto" />
                          ) : (
                            <span className="font-mono text-sm text-foreground">{entry.rank}</span>
                          )}
                        </div>
                        <div>
                          {entry.imageUrl || entry.fallbackImageUrl ? (
                            <PetImage src={entry.imageUrl} fallbackSrc={entry.fallbackImageUrl} alt="" className="w-7 h-7 rounded" />
                          ) : (
                            <div className="w-7 h-7 rounded bg-muted/50" />
                          )}
                        </div>
                        <div>
                          <Link to={`/creatures/${entry.creatureId}`}>
                            <p className={cn(
                              'font-medium text-sm truncate',
                              isUser ? 'text-primary' : 'text-foreground'
                            )}>
                              {entry.creatureName}
                            </p>
                          </Link>
                          <RarityBadge rarity={entry.rarity} className="mt-0.5" />
                        </div>
                        <div className="text-center">
                          <span className="font-mono text-xs text-foreground">
                            {entry.wins}/{entry.places}/{entry.shows}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs text-foreground">{entry.racesEntered}</span>
                        </div>
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
                          {race.collectionName && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-[10px] text-primary/70 font-semibold">
                                {race.collectionName}
                              </span>
                            </>
                          )}
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

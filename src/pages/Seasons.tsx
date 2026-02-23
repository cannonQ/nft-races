import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Trophy, ChevronRight, ChevronDown, Crown, Medal, Award, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { CollectionFilter } from '@/components/ui/CollectionFilter';
import { Skeleton } from '@/components/ui/skeleton';
import { PetImage } from '@/components/creatures/PetImage';
import { RarityBadge } from '@/components/creatures/StatBar';
import { useAllSeasons, useCollections, useLeaderboard, API_BASE } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { useCollectionFilter } from '@/hooks/useCollectionFilter';
import { cn } from '@/lib/utils';
import type { Season, LeaderboardEntry } from '@/types/game';

function truncateAddress(addr: string): string {
  if (addr.length <= 15) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Active Season Card ─────────────────────────────────── */

function ActiveSeasonCard({ season }: { season: Season }) {
  return (
    <div className="cyber-card rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">{season.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {season.collectionName && <span className="mr-2">{season.collectionName}</span>}
            {formatDateShort(season.startDate)} — {formatDateShort(season.endDate)}
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded">
          Active
        </span>
      </div>

      {season.modifier?.theme && (
        <p className="text-xs text-muted-foreground italic">
          {season.modifier.theme}{season.modifier.description ? ` — ${season.modifier.description}` : ''}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Prize Pool</p>
          <p className="font-mono text-xl font-bold text-accent">
            {season.prizePool.toFixed(2)} ERG
            {(season as any).prizePoolToken > 0 && (season as any).prizePoolTokenName && (
              <span className="ml-2">+ {(season as any).prizePoolToken.toLocaleString()} {(season as any).prizePoolTokenName}</span>
            )}
          </p>
        </div>
        <Link
          to="/leaderboard"
          className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          <Trophy className="w-3.5 h-3.5" />
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}

/* ── Past Season Row (expandable) ───────────────────────── */

function PastSeasonRow({ season, address }: { season: Season; address: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    if (leaderboard) return; // cached
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leaderboard?season=${season.id}`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch {
      // silently fail — expanded section will be empty
    } finally {
      setLoading(false);
    }
  }, [season.id, leaderboard]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) fetchLeaderboard();
  };

  const startStr = formatDateShort(season.startDate);
  const endStr = formatDateShort(season.endDate);

  // Once leaderboard is loaded, compute total distributed (per-race fees + season payouts)
  const totalDistributed = leaderboard
    ? leaderboard.reduce((sum, e) => sum + e.earnings, 0)
    : null;

  return (
    <div className="rounded-lg bg-muted/20 overflow-hidden">
      {/* Summary row */}
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between py-3 px-4 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {loading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
          ) : expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <span className="text-sm text-foreground font-semibold">{season.name}</span>
            <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
              {season.collectionName && <span>{season.collectionName}</span>}
              {startStr && endStr && <span>{startStr} — {endStr}</span>}
            </div>
          </div>
        </div>
        <span className="font-mono text-sm font-semibold text-accent shrink-0 ml-2">
          {(totalDistributed ?? season.prizePool).toFixed(2)} ERG
        </span>
      </button>

      {/* Expanded leaderboard */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border/30">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ) : leaderboard && leaderboard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/30">
                    <th className="text-left py-1.5 pr-2 w-8">#</th>
                    <th className="text-left py-1.5 pr-2">Creature</th>
                    <th className="text-left py-1.5 pr-2 hidden sm:table-cell">Owner</th>
                    <th className="text-center py-1.5 px-1">W</th>
                    <th className="text-center py-1.5 px-1">P</th>
                    <th className="text-center py-1.5 px-1">S</th>
                    <th className="text-right py-1.5 px-1">LP</th>
                    <th className="text-right py-1.5 pl-1">ERG</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, 20).map((entry) => {
                    const isUser = address && entry.ownerAddress === address;
                    const podiumIcon = entry.rank === 1 ? Crown : entry.rank === 2 ? Medal : entry.rank === 3 ? Award : null;
                    const PodiumIcon = podiumIcon;
                    const podiumColor = entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-gray-300' : entry.rank === 3 ? 'text-amber-600' : '';

                    return (
                      <tr
                        key={entry.creatureId}
                        className={cn(
                          'border-b border-border/10',
                          isUser && 'bg-primary/5'
                        )}
                      >
                        <td className="py-1.5 pr-2">
                          {PodiumIcon ? (
                            <PodiumIcon className={cn('w-4 h-4', podiumColor)} />
                          ) : (
                            <span className="text-muted-foreground">{entry.rank}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          <Link
                            to={`/creatures/${entry.creatureId}`}
                            className="flex items-center gap-2 hover:text-primary transition-colors"
                          >
                            <PetImage
                              src={entry.imageUrl}
                              fallbackSrc={entry.fallbackImageUrl}
                              alt={entry.creatureName}
                              className="w-5 h-5 rounded shrink-0"
                            />
                            <span className="text-foreground truncate">{entry.creatureName}</span>
                            <RarityBadge rarity={entry.rarity} className="text-[8px] px-1 py-0" />
                          </Link>
                        </td>
                        <td className="py-1.5 pr-2 text-muted-foreground hidden sm:table-cell">
                          {entry.ownerDisplayName || truncateAddress(entry.ownerAddress)}
                          {isUser && <span className="ml-1 text-primary text-[10px]">(you)</span>}
                        </td>
                        <td className="py-1.5 px-1 text-center">{entry.wins}</td>
                        <td className="py-1.5 px-1 text-center">{entry.places}</td>
                        <td className="py-1.5 px-1 text-center">{entry.shows}</td>
                        <td className="py-1.5 px-1 text-right font-mono font-semibold text-primary">
                          {entry.leaguePoints.toFixed(1)}
                        </td>
                        <td className="py-1.5 pl-1 text-right font-mono font-semibold text-accent">
                          {entry.earnings > 0 ? entry.earnings.toFixed(2) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {leaderboard.length > 20 && (
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Showing top 20 of {leaderboard.length}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              No leaderboard data for this season.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────── */

export default function Seasons() {
  const { address } = useWallet();
  const { data: allSeasons, loading } = useAllSeasons();
  const { data: collections } = useCollections();
  const { active: activeCollections, toggle: toggleCollection, matches: matchesCollection } = useCollectionFilter();

  const filtered = (allSeasons ?? []).filter(s => matchesCollection(s.collectionId));
  const activeSeasons = filtered.filter(s => s.status === 'active');
  const completedSeasons = filtered.filter(s => s.status === 'completed');

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            Seasons
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Active and past season standings
          </p>
        </div>

        <CollectionFilter
          collections={collections || []}
          active={activeCollections}
          onToggle={toggleCollection}
        />

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="cyber-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No seasons found.</p>
          </div>
        ) : (
          <>
            {/* Active Seasons */}
            {activeSeasons.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Active Seasons
                </h2>
                {activeSeasons.map(s => (
                  <ActiveSeasonCard key={s.id} season={s} />
                ))}
              </section>
            )}

            {/* Completed Seasons */}
            {completedSeasons.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Past Seasons ({completedSeasons.length})
                </h2>
                {completedSeasons.map(s => (
                  <PastSeasonRow key={s.id} season={s} address={address} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

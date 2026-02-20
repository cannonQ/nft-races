import { useState } from 'react';
import { Trophy, ChevronRight, ChevronDown } from 'lucide-react';
import { useWalletLedger } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { PetImage } from '@/components/creatures/PetImage';
import { Skeleton } from '@/components/ui/skeleton';
import type { SeasonPayoutSeason, SeasonPayoutCreature } from '@/types/game';

export function SeasonEarnings() {
  const { address } = useWallet();
  const { data: ledger, loading } = useWalletLedger(address);
  const [expandedSeasonId, setExpandedSeasonId] = useState<string | null>(null);

  if (!address || loading) {
    if (loading) return <Skeleton className="h-24 rounded-xl mb-4" />;
    return null;
  }

  const payouts = ledger?.seasonPayouts;
  if (!payouts || payouts.totalEarnedNanoerg === 0) return null;

  const toggleSeason = (id: string) => {
    setExpandedSeasonId(prev => (prev === id ? null : id));
  };

  return (
    <div className="cyber-card rounded-xl p-4 mb-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-accent">
            +{payouts.totalEarnedErg.toFixed(2)} ERG
          </p>
          <p className="text-[10px] text-muted-foreground">Season Earnings</p>
        </div>
      </div>

      {/* Per-season expandable rows */}
      <div className="space-y-2">
        {payouts.seasons.map((season: SeasonPayoutSeason) => {
          const isExpanded = expandedSeasonId === season.seasonId;
          const creatures = payouts.byCreature.filter(
            (c: SeasonPayoutCreature) => c.seasonId === season.seasonId
          );
          const startStr = season.startDate
            ? new Date(season.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';
          const endStr = season.endDate
            ? new Date(season.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';

          return (
            <div key={season.seasonId} className="rounded-lg bg-muted/20 overflow-hidden">
              {/* Clickable summary row */}
              <button
                type="button"
                onClick={() => toggleSeason(season.seasonId)}
                className="w-full flex items-center justify-between py-2 px-3 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="text-sm text-foreground font-semibold">{season.seasonName}</span>
                    <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                      {season.collectionName && <span>{season.collectionName}</span>}
                      {startStr && endStr && <span>{startStr} — {endStr}</span>}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-accent shrink-0 ml-2">
                  +{season.yourTotalErg.toFixed(2)} ERG
                </span>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-2 border-t border-border/30 space-y-3">
                  {/* Pool breakdown cards */}
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: 'wins', label: 'WINS (40%)', value: season.yourWinsErg, color: 'text-accent' },
                      { key: 'places', label: 'PLACES (35%)', value: season.yourPlacesErg, color: 'text-primary' },
                      { key: 'shows', label: 'SHOWS (25%)', value: season.yourShowsErg, color: 'text-muted-foreground' },
                    ] as const).map(pool => (
                      <div key={pool.key} className="rounded-lg bg-background/50 p-2 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{pool.label}</p>
                        <p className={`font-mono text-xs font-semibold ${pool.color}`}>
                          {pool.value.toFixed(2)} ERG
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Creature payout table */}
                  {creatures.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/30">
                            <th className="text-left py-1 pr-2">Creature</th>
                            <th className="text-center py-1 px-1">W</th>
                            <th className="text-center py-1 px-1">P</th>
                            <th className="text-center py-1 px-1">S</th>
                            <th className="text-right py-1 px-1">Wins</th>
                            <th className="text-right py-1 px-1">Places</th>
                            <th className="text-right py-1 px-1">Shows</th>
                            <th className="text-right py-1 pl-1">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creatures.map((c: SeasonPayoutCreature) => (
                            <tr key={c.creatureId} className="border-b border-border/10">
                              <td className="py-1.5 pr-2">
                                <div className="flex items-center gap-2">
                                  <PetImage
                                    src={c.creatureImageUrl ?? undefined}
                                    fallbackSrc={c.creatureFallbackImageUrl ?? undefined}
                                    alt={c.creatureName}
                                    className="w-5 h-5 rounded shrink-0"
                                  />
                                  <span className="text-foreground truncate">{c.creatureName}</span>
                                </div>
                              </td>
                              <td className="py-1.5 px-1 text-center">{c.wins}</td>
                              <td className="py-1.5 px-1 text-center">{c.places}</td>
                              <td className="py-1.5 px-1 text-center">{c.shows}</td>
                              <td className="py-1.5 px-1 text-right font-mono text-accent">
                                {c.winsErg > 0 ? c.winsErg.toFixed(2) : '—'}
                              </td>
                              <td className="py-1.5 px-1 text-right font-mono text-primary">
                                {c.placesErg > 0 ? c.placesErg.toFixed(2) : '—'}
                              </td>
                              <td className="py-1.5 px-1 text-right font-mono text-muted-foreground">
                                {c.showsErg > 0 ? c.showsErg.toFixed(2) : '—'}
                              </td>
                              <td className="py-1.5 pl-1 text-right font-mono font-semibold text-foreground">
                                {c.totalErg.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

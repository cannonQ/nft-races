import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase.js';
import { getActiveSeason, getCreatureDisplayName, getCreatureImageUrl, getCreatureFallbackImageUrl } from '../_lib/helpers.js';
import { nanoErgToErg } from '../_lib/constants.js';
import { getLoaderBySlug } from '../_lib/collections/registry.js';
import type { CollectionLoader } from '../_lib/collections/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    let seasonId = req.query.season as string | undefined;
    const collectionId = req.query.collectionId as string | undefined;

    // Default to active season if none specified
    if (!seasonId) {
      const season = await getActiveSeason(collectionId);
      if (!season) {
        return res.status(404).json({ error: 'No active season' });
      }
      seasonId = season.id;
    }

    const { data, error } = await supabase
      .from('season_leaderboard')
      .select('*, creatures(name, token_id, rarity, metadata, collection_id)')
      .eq('season_id', seasonId)
      .order('league_points', { ascending: false })
      .order('wins', { ascending: false })
      .order('places', { ascending: false })
      .order('shows', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    // Build loader lookup by collection_id for correct image/name resolution
    const collectionIds = [...new Set((data ?? []).map((r: any) => r.creatures?.collection_id).filter(Boolean))];
    const loadersByCollectionId = new Map<string, CollectionLoader>();
    if (collectionIds.length > 0) {
      const { data: cols } = await supabase
        .from('collections')
        .select('id, name')
        .in('id', collectionIds);
      for (const col of (cols ?? [])) {
        const loader = getLoaderBySlug(col.name);
        if (loader) loadersByCollectionId.set(col.id, loader);
      }
    }

    // Fetch real per-race prize earnings from race entries (excludes free-play shadow races).
    // Only count races where real fees were paid (entry_fee_nanoerg > 0 AND at least one
    // non-shadow credit_ledger entry exists for that race).
    // Also fetch season-end payouts from credit_ledger.
    let raceEarningsByCreature: Record<string, number> = {};
    let payoutByCreature: Record<string, number> = {};

    // 1. Per-race prizes: sum payout_nanoerg from race entries where the race had real fees
    {
      const { data: raceEntries } = await supabase
        .from('season_race_entries')
        .select('creature_id, payout_nanoerg, race_id, season_races!inner(entry_fee_nanoerg)')
        .eq('season_races.season_id', seasonId)
        .not('payout_nanoerg', 'is', null)
        .gt('payout_nanoerg', 0);

      if (raceEntries && raceEntries.length > 0) {
        // Find which races had real (non-shadow) fee payments
        const raceIds = [...new Set(raceEntries.map((e: any) => e.race_id))];
        const { data: realFeeEntries } = await supabase
          .from('credit_ledger')
          .select('race_id')
          .in('race_id', raceIds)
          .eq('tx_type', 'race_entry_fee')
          .eq('shadow', false);
        const realRaceIds = new Set((realFeeEntries ?? []).map((e: any) => e.race_id));

        for (const e of raceEntries) {
          if (realRaceIds.has(e.race_id) && e.creature_id) {
            raceEarningsByCreature[e.creature_id] = (raceEarningsByCreature[e.creature_id] ?? 0) + (e.payout_nanoerg ?? 0);
          }
        }
      }
    }

    // 2. Season-end payouts from credit_ledger
    {
      const { data: payouts } = await supabase
        .from('credit_ledger')
        .select('creature_id, amount_nanoerg')
        .eq('season_id', seasonId)
        .eq('tx_type', 'season_payout');
      for (const p of (payouts ?? [])) {
        if (p.creature_id) {
          payoutByCreature[p.creature_id] = (payoutByCreature[p.creature_id] ?? 0) + (p.amount_nanoerg ?? 0);
        }
      }
    }

    const hasRealEarnings = Object.keys(raceEarningsByCreature).length > 0 || Object.keys(payoutByCreature).length > 0;

    // Compute average scores from race entries
    const creatureIds = (data ?? []).map((r: any) => r.creature_id);
    let avgScores: Record<string, number> = {};
    if (creatureIds.length > 0) {
      const { data: entries } = await supabase
        .from('season_race_entries')
        .select('creature_id, performance_score')
        .in('creature_id', creatureIds)
        .not('performance_score', 'is', null);
      if (entries) {
        const totals: Record<string, { sum: number; count: number }> = {};
        for (const e of entries) {
          if (!totals[e.creature_id]) totals[e.creature_id] = { sum: 0, count: 0 };
          totals[e.creature_id].sum += e.performance_score ?? 0;
          totals[e.creature_id].count += 1;
        }
        for (const [id, { sum, count }] of Object.entries(totals)) {
          avgScores[id] = Math.round((sum / count) * 100) / 100;
        }
      }
    }

    // Batch-fetch display names for all owners
    const ownerAddresses = [...new Set((data ?? []).map((r: any) => r.owner_address as string))];
    let displayNames: Record<string, string> = {};
    if (ownerAddresses.length > 0) {
      const { data: profiles } = await supabase
        .from('wallet_profiles')
        .select('address, display_name')
        .in('address', ownerAddresses);
      if (profiles) {
        for (const p of profiles) {
          displayNames[p.address] = p.display_name;
        }
      }
    }

    const result = (data ?? []).map((row: any, index: number) => {
      const loader = loadersByCollectionId.get(row.creatures?.collection_id);
      return {
      rank: index + 1,
      creatureId: row.creature_id,
      creatureName: getCreatureDisplayName(row.creatures?.metadata, row.creatures?.name ?? 'Unknown', loader),
      tokenId: row.creatures?.token_id ?? '',
      rarity: (row.creatures?.rarity ?? 'common').toLowerCase(),
      imageUrl: getCreatureImageUrl(row.creatures?.metadata, loader),
      fallbackImageUrl: getCreatureFallbackImageUrl(row.creatures?.metadata, loader),
      ownerAddress: row.owner_address,
      ownerDisplayName: displayNames[row.owner_address] ?? null,
      wins: row.wins ?? 0,
      places: row.places ?? 0,
      shows: row.shows ?? 0,
      racesEntered: row.races_entered ?? 0,
      leaguePoints: row.league_points ?? 0,
      avgScore: avgScores[row.creature_id] ?? 0,
      earnings: hasRealEarnings
        ? nanoErgToErg((raceEarningsByCreature[row.creature_id] ?? 0) + (payoutByCreature[row.creature_id] ?? 0))
        : nanoErgToErg(row.total_earnings_nanoerg ?? 0),
    };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

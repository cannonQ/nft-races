import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { nanoErgToErg } from '../../../_lib/constants.js';
import { getWalletBalance } from '../../../_lib/credit-ledger.js';
import { getActiveSeasons, getCreatureImageUrl, getCreatureFallbackImageUrl, getCreatureDisplayName } from '../../../_lib/helpers.js';
import { getLoaderBySlug } from '../../../_lib/collections/registry.js';
import { getGameConfig } from '../../../_lib/config.js';
import type { CollectionLoader } from '../../../_lib/collections/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const address = req.query.address as string;
  if (!address) {
    return res.status(400).json({ error: 'address is required' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Fetch paginated ledger entries
    const { data: entries, error: entriesErr } = await supabase
      .from('credit_ledger')
      .select('*')
      .eq('owner_address', address)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (entriesErr) {
      console.error('Ledger fetch error:', entriesErr);
      return res.status(500).json({ error: 'Failed to fetch ledger' });
    }

    // Get balance from latest entry snapshot
    const balance = await getWalletBalance(address);

    // Compute spent/earned from all entries for this wallet
    const { data: debits } = await supabase
      .from('credit_ledger')
      .select('amount_nanoerg')
      .eq('owner_address', address)
      .lt('amount_nanoerg', 0);

    const { data: credits } = await supabase
      .from('credit_ledger')
      .select('amount_nanoerg')
      .eq('owner_address', address)
      .gt('amount_nanoerg', 0);

    const totalSpent = Math.abs(
      (debits ?? []).reduce((sum: number, r: any) => sum + r.amount_nanoerg, 0)
    );
    const totalEarned = (credits ?? []).reduce(
      (sum: number, r: any) => sum + r.amount_nanoerg, 0
    );

    // Season context: per-collection prize pools
    const seasons = await getActiveSeasons();
    const prizePools = seasons.map((s: any) => ({
      collectionId: s.collection_id,
      collectionName: s.collections?.name ?? 'Unknown',
      prizePoolNanoerg: s.prize_pool_nanoerg ?? 0,
      prizePoolErg: nanoErgToErg(s.prize_pool_nanoerg ?? 0),
    }));

    // Build season_id → collection lookup for entry-level collection context
    const seasonCollectionMap: Record<string, { collectionId: string; collectionName: string }> = {};
    for (const s of seasons) {
      seasonCollectionMap[s.id] = {
        collectionId: s.collection_id,
        collectionName: s.collections?.name ?? 'Unknown',
      };
    }
    // Backward compat: single combined prize pool
    const seasonPrizePoolNanoerg = seasons.reduce(
      (sum: number, s: any) => sum + (s.prize_pool_nanoerg ?? 0), 0
    );

    // Count training sessions and race entries from ledger
    const { data: allDebits } = await supabase
      .from('credit_ledger')
      .select('tx_type, creature_id, amount_nanoerg')
      .eq('owner_address', address)
      .lt('amount_nanoerg', 0);

    const trainingCount = (allDebits ?? []).filter((d: any) => d.tx_type === 'training_fee').length;
    const racesEntered = (allDebits ?? []).filter((d: any) => d.tx_type === 'race_entry_fee').length;

    // Per-creature spending breakdown
    const creatureMap: Record<string, number> = {};
    for (const d of allDebits ?? []) {
      if (d.creature_id) {
        creatureMap[d.creature_id] = (creatureMap[d.creature_id] ?? 0) + Math.abs(d.amount_nanoerg);
      }
    }
    const creatureSpending = Object.entries(creatureMap).map(([creatureId, spentNanoerg]) => ({
      creatureId,
      spentNanoerg,
      spentErg: nanoErgToErg(spentNanoerg),
    }));

    // Batch-fetch creature info for entries that have a creature_id
    const entryCreatureIds = [...new Set((entries ?? []).map((e: any) => e.creature_id).filter(Boolean))];
    const creatureInfoMap = new Map<string, { name: string; imageUrl?: string; fallbackImageUrl?: string }>();
    if (entryCreatureIds.length > 0) {
      const { data: creatures } = await supabase
        .from('creatures')
        .select('id, name, metadata, collection_id')
        .in('id', entryCreatureIds);

      // Build loader lookup
      const colIds = [...new Set((creatures ?? []).map((c: any) => c.collection_id).filter(Boolean))];
      const loadersByColId = new Map<string, CollectionLoader>();
      if (colIds.length > 0) {
        const { data: cols } = await supabase.from('collections').select('id, name').in('id', colIds);
        for (const col of (cols ?? [])) {
          const loader = getLoaderBySlug(col.name);
          if (loader) loadersByColId.set(col.id, loader);
        }
      }

      for (const c of (creatures ?? [])) {
        const loader = loadersByColId.get(c.collection_id);
        creatureInfoMap.set(c.id, {
          name: getCreatureDisplayName(c.metadata, c.name, loader),
          imageUrl: getCreatureImageUrl(c.metadata, loader),
          fallbackImageUrl: getCreatureFallbackImageUrl(c.metadata, loader),
        });
      }
    }

    // Build season name lookup (active seasons)
    const seasonNameMap: Record<string, string> = {};
    for (const s of seasons) {
      seasonNameMap[s.id] = s.name ?? 'Season';
    }

    // --- Season payouts aggregation ---
    const { data: payoutRows } = await supabase
      .from('credit_ledger')
      .select('season_id, creature_id, amount_nanoerg, memo')
      .eq('owner_address', address)
      .eq('tx_type', 'season_payout');

    // Fetch season metadata for completed seasons referenced by payouts
    const payoutSeasonIds = [...new Set((payoutRows ?? []).map(r => r.season_id).filter(Boolean))];
    const seasonMetaMap: Record<string, { name: string; startDate: string; endDate: string; prizePoolErg: number; collectionName: string }> = {};
    if (payoutSeasonIds.length > 0) {
      const { data: payoutSeasons } = await supabase
        .from('seasons')
        .select('id, name, start_date, end_date, prize_pool_nanoerg, collections(name)')
        .in('id', payoutSeasonIds);
      for (const ps of (payoutSeasons ?? [])) {
        seasonMetaMap[ps.id] = {
          name: ps.name ?? 'Season',
          startDate: ps.start_date,
          endDate: ps.end_date,
          prizePoolErg: nanoErgToErg(ps.prize_pool_nanoerg ?? 0),
          collectionName: (ps.collections as any)?.name ?? 'Unknown',
        };
        // Also fill seasonNameMap for entries that reference completed seasons
        if (!seasonNameMap[ps.id]) {
          seasonNameMap[ps.id] = ps.name ?? 'Season';
        }
      }
    }

    // Ensure creature info for payout creatures not already in the map
    const payoutCreatureIds = [...new Set((payoutRows ?? []).map(r => r.creature_id).filter(Boolean))];
    const missingCreatureIds = payoutCreatureIds.filter(id => !creatureInfoMap.has(id));
    if (missingCreatureIds.length > 0) {
      const { data: missingCreatures } = await supabase
        .from('creatures')
        .select('id, name, metadata, collection_id')
        .in('id', missingCreatureIds);

      const missingColIds = [...new Set((missingCreatures ?? []).map((c: any) => c.collection_id).filter(Boolean))];
      const missingLoaders = new Map<string, CollectionLoader>();
      if (missingColIds.length > 0) {
        const { data: cols } = await supabase.from('collections').select('id, name').in('id', missingColIds);
        for (const col of (cols ?? [])) {
          const loader = getLoaderBySlug(col.name);
          if (loader) missingLoaders.set(col.id, loader);
        }
      }
      for (const c of (missingCreatures ?? [])) {
        const loader = missingLoaders.get(c.collection_id);
        creatureInfoMap.set(c.id, {
          name: getCreatureDisplayName(c.metadata, c.name, loader),
          imageUrl: getCreatureImageUrl(c.metadata, loader),
          fallbackImageUrl: getCreatureFallbackImageUrl(c.metadata, loader),
        });
      }
    }

    // Fetch open-race W/P/S counts for this wallet's creatures in payout seasons
    const wpsCountMap = new Map<string, { wins: number; places: number; shows: number }>();
    if (payoutSeasonIds.length > 0 && payoutCreatureIds.length > 0) {
      const { data: raceFinishes } = await supabase
        .from('season_race_entries')
        .select('creature_id, finish_position, season_races!inner(season_id, rarity_class)')
        .eq('owner_address', address)
        .is('season_races.rarity_class', null)
        .not('finish_position', 'is', null)
        .in('season_races.season_id', payoutSeasonIds);

      for (const f of (raceFinishes ?? [])) {
        const sid = (f.season_races as any)?.season_id;
        const key = `${sid}:${f.creature_id}`;
        if (!wpsCountMap.has(key)) {
          wpsCountMap.set(key, { wins: 0, places: 0, shows: 0 });
        }
        const c = wpsCountMap.get(key)!;
        if (f.finish_position === 1) c.wins++;
        if (f.finish_position === 2) c.places++;
        if (f.finish_position === 3) c.shows++;
      }
    }

    // Aggregate payouts by season + creature
    const POOL_RE = /Season payout: (\w+) pool/;
    const payoutAggMap = new Map<string, {
      seasonId: string; seasonName: string;
      creatureId: string; creatureName: string;
      creatureImageUrl?: string; creatureFallbackImageUrl?: string;
      winsNanoerg: number; placesNanoerg: number; showsNanoerg: number; totalNanoerg: number;
    }>();
    let seasonPayoutsTotalNanoerg = 0;

    for (const row of (payoutRows ?? [])) {
      const key = `${row.season_id}:${row.creature_id}`;
      if (!payoutAggMap.has(key)) {
        const cInfo = creatureInfoMap.get(row.creature_id);
        payoutAggMap.set(key, {
          seasonId: row.season_id,
          seasonName: seasonNameMap[row.season_id] ?? 'Season',
          creatureId: row.creature_id,
          creatureName: cInfo?.name ?? 'Unknown',
          creatureImageUrl: cInfo?.imageUrl,
          creatureFallbackImageUrl: cInfo?.fallbackImageUrl,
          winsNanoerg: 0, placesNanoerg: 0, showsNanoerg: 0, totalNanoerg: 0,
        });
      }
      const agg = payoutAggMap.get(key)!;
      const pool = row.memo?.match(POOL_RE)?.[1];
      const amt = row.amount_nanoerg ?? 0;
      if (pool === 'wins') agg.winsNanoerg += amt;
      else if (pool === 'places') agg.placesNanoerg += amt;
      else if (pool === 'shows') agg.showsNanoerg += amt;
      agg.totalNanoerg += amt;
      seasonPayoutsTotalNanoerg += amt;
    }

    // Group by season for per-season summary
    const seasonTotalsMap = new Map<string, { winsNanoerg: number; placesNanoerg: number; showsNanoerg: number; totalNanoerg: number }>();
    for (const agg of payoutAggMap.values()) {
      if (!seasonTotalsMap.has(agg.seasonId)) {
        seasonTotalsMap.set(agg.seasonId, { winsNanoerg: 0, placesNanoerg: 0, showsNanoerg: 0, totalNanoerg: 0 });
      }
      const st = seasonTotalsMap.get(agg.seasonId)!;
      st.winsNanoerg += agg.winsNanoerg;
      st.placesNanoerg += agg.placesNanoerg;
      st.showsNanoerg += agg.showsNanoerg;
      st.totalNanoerg += agg.totalNanoerg;
    }

    const seasonPayouts = {
      totalEarnedNanoerg: seasonPayoutsTotalNanoerg,
      totalEarnedErg: nanoErgToErg(seasonPayoutsTotalNanoerg),
      seasons: payoutSeasonIds.map(sid => {
        const meta = seasonMetaMap[sid];
        const totals = seasonTotalsMap.get(sid);
        return {
          seasonId: sid,
          seasonName: meta?.name ?? 'Season',
          collectionName: meta?.collectionName ?? null,
          startDate: meta?.startDate ?? null,
          endDate: meta?.endDate ?? null,
          prizePoolErg: meta?.prizePoolErg ?? 0,
          yourTotalErg: nanoErgToErg(totals?.totalNanoerg ?? 0),
          yourWinsErg: nanoErgToErg(totals?.winsNanoerg ?? 0),
          yourPlacesErg: nanoErgToErg(totals?.placesNanoerg ?? 0),
          yourShowsErg: nanoErgToErg(totals?.showsNanoerg ?? 0),
        };
      }),
      byCreature: [...payoutAggMap.values()]
        .sort((a, b) => b.totalNanoerg - a.totalNanoerg)
        .map(a => {
          const wps = wpsCountMap.get(`${a.seasonId}:${a.creatureId}`);
          return {
            seasonId: a.seasonId,
            seasonName: a.seasonName,
            creatureId: a.creatureId,
            creatureName: a.creatureName,
            creatureImageUrl: a.creatureImageUrl ?? null,
            creatureFallbackImageUrl: a.creatureFallbackImageUrl ?? null,
            wins: wps?.wins ?? 0,
            places: wps?.places ?? 0,
            shows: wps?.shows ?? 0,
            winsErg: nanoErgToErg(a.winsNanoerg),
            placesErg: nanoErgToErg(a.placesNanoerg),
            showsErg: nanoErgToErg(a.showsNanoerg),
            totalErg: nanoErgToErg(a.totalNanoerg),
          };
        }),
    };

    // Batch-fetch race names for entries that have a race_id
    const entryRaceIds = [...new Set((entries ?? []).map((e: any) => e.race_id).filter(Boolean))];
    const raceNameMap: Record<string, string> = {};
    if (entryRaceIds.length > 0) {
      const { data: races } = await supabase
        .from('season_races')
        .select('id, name')
        .in('id', entryRaceIds);
      for (const r of (races ?? [])) {
        raceNameMap[r.id] = r.name;
      }
    }

    // Build tokenId → name lookup from collection fee_token configs
    const tokenIdToName: Record<string, string> = {};
    const uniqueCollectionIds = [...new Set(seasons.map((s: any) => s.collection_id).filter(Boolean))];
    for (const colId of uniqueCollectionIds) {
      const cfg = await getGameConfig(colId);
      if (cfg?.fee_token?.token_id && cfg?.fee_token?.name) {
        tokenIdToName[cfg.fee_token.token_id] = cfg.fee_token.name;
      }
    }

    return res.status(200).json({
      balance,
      balanceErg: nanoErgToErg(balance),
      totalSpent,
      totalSpentErg: nanoErgToErg(totalSpent),
      totalEarned,
      totalEarnedErg: nanoErgToErg(totalEarned),
      seasonPrizePoolNanoerg,
      seasonPrizePoolErg: nanoErgToErg(seasonPrizePoolNanoerg),
      prizePools,
      trainingCount,
      racesEntered,
      creatureSpending,
      seasonPayouts,
      entries: (entries ?? []).map((e: any) => {
        const col = e.season_id ? seasonCollectionMap[e.season_id] : undefined;
        const creature = e.creature_id ? creatureInfoMap.get(e.creature_id) : undefined;
        return {
          id: e.id,
          txType: e.tx_type,
          amountNanoerg: e.amount_nanoerg,
          amountErg: nanoErgToErg(e.amount_nanoerg),
          balanceAfterNanoerg: e.balance_after_nanoerg,
          creatureId: e.creature_id,
          creatureName: creature?.name ?? null,
          creatureImageUrl: creature?.imageUrl ?? null,
          creatureFallbackImageUrl: creature?.fallbackImageUrl ?? null,
          raceId: e.race_id,
          raceName: e.race_id ? (raceNameMap[e.race_id] ?? null) : null,
          seasonId: e.season_id,
          seasonName: e.season_id ? (seasonNameMap[e.season_id] ?? null) : null,
          collectionId: col?.collectionId ?? null,
          collectionName: col?.collectionName ?? null,
          memo: e.memo,
          txId: e.tx_id ?? null,
          shadow: e.shadow ?? true,
          feeTokenId: e.fee_token_id ?? null,
          feeTokenAmount: e.fee_token_amount ?? null,
          feeTokenName: e.fee_token_id ? (tokenIdToName[e.fee_token_id] ?? null) : null,
          createdAt: e.created_at,
        };
      }),
    });
  } catch (err) {
    console.error('GET /api/v2/wallet/[address]/ledger error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

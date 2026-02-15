import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { nanoErgToErg } from '../../../_lib/constants.js';
import { getWalletBalance } from '../../../_lib/credit-ledger.js';
import { getActiveSeasons, getCreatureImageUrl, getCreatureFallbackImageUrl, getCreatureDisplayName } from '../../../_lib/helpers.js';
import { getLoaderBySlug } from '../../../_lib/collections/registry.js';
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

    // Build season name lookup
    const seasonNameMap: Record<string, string> = {};
    for (const s of seasons) {
      seasonNameMap[s.id] = s.name ?? 'Season';
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
          seasonId: e.season_id,
          seasonName: e.season_id ? (seasonNameMap[e.season_id] ?? null) : null,
          collectionId: col?.collectionId ?? null,
          collectionName: col?.collectionName ?? null,
          memo: e.memo,
          txId: e.tx_id ?? null,
          shadow: e.shadow ?? true,
          createdAt: e.created_at,
        };
      }),
    });
  } catch (err) {
    console.error('GET /api/v2/wallet/[address]/ledger error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

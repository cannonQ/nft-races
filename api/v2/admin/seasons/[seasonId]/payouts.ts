import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../../_lib/supabase.js';
import { requireAdmin } from '../../../../_lib/auth.js';
import { nanoErgToErg } from '../../../../_lib/constants.js';
import { getCreatureDisplayName, getCreatureImageUrl, getCreatureFallbackImageUrl } from '../../../../_lib/helpers.js';
import { getLoaderBySlug } from '../../../../_lib/collections/registry.js';
import type { CollectionLoader } from '../../../../_lib/collections/types.js';

const POOL_RE = /Season payout: (\w+) pool/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  if (!requireAdmin(req, res)) return;

  const seasonId = req.query.seasonId as string;
  if (!seasonId) {
    return res.status(400).json({ error: 'seasonId is required' });
  }

  try {
    // 1. Fetch all season_payout entries for this season
    const { data: payoutRows, error: payoutErr } = await supabase
      .from('credit_ledger')
      .select('creature_id, owner_address, amount_nanoerg, memo, shadow, tx_id')
      .eq('season_id', seasonId)
      .eq('tx_type', 'season_payout');

    if (payoutErr) {
      console.error('Payout fetch error:', payoutErr);
      return res.status(500).json({ error: 'Failed to fetch payouts' });
    }

    if (!payoutRows || payoutRows.length === 0) {
      return res.status(200).json({
        seasonId,
        totalPayoutsErg: 0,
        uniqueWallets: 0,
        payoutCount: 0,
        pools: {
          wins: { totalErg: 0, percentage: 40 },
          places: { totalErg: 0, percentage: 35 },
          shows: { totalErg: 0, percentage: 25 },
        },
        creatures: [],
      });
    }

    // 2. Compute open-race-only W/P/S (matches payout distribution logic)
    const { data: openRaceEntries } = await supabase
      .from('season_race_entries')
      .select('creature_id, owner_address, finish_position, season_races!inner(rarity_class)')
      .eq('season_races.season_id', seasonId)
      .eq('season_races.status', 'resolved')
      .is('season_races.rarity_class', null)
      .not('finish_position', 'is', null);

    const standingsMap = new Map<string, { wins: number; places: number; shows: number; racesEntered: number }>();
    for (const e of (openRaceEntries ?? [])) {
      if (!standingsMap.has(e.creature_id)) {
        standingsMap.set(e.creature_id, { wins: 0, places: 0, shows: 0, racesEntered: 0 });
      }
      const s = standingsMap.get(e.creature_id)!;
      s.racesEntered++;
      if (e.finish_position === 1) s.wins++;
      if (e.finish_position === 2) s.places++;
      if (e.finish_position === 3) s.shows++;
    }

    // 3. Batch-fetch creature info
    const creatureIds = [...new Set(payoutRows.map(r => r.creature_id).filter(Boolean))];
    const creatureInfoMap = new Map<string, { name: string; imageUrl?: string; fallbackImageUrl?: string }>();

    if (creatureIds.length > 0) {
      const { data: creatures } = await supabase
        .from('creatures')
        .select('id, name, metadata, collection_id')
        .in('id', creatureIds);

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

    // 4. Batch-fetch wallet display names
    const ownerAddresses = [...new Set(payoutRows.map(r => r.owner_address))];
    const displayNames: Record<string, string> = {};
    if (ownerAddresses.length > 0) {
      const { data: profiles } = await supabase
        .from('wallet_profiles')
        .select('address, display_name')
        .in('address', ownerAddresses);
      for (const p of (profiles ?? [])) {
        displayNames[p.address] = p.display_name;
      }
    }

    // 5. Group by creature, aggregate per-pool amounts
    const creaturePayouts = new Map<string, {
      creatureId: string;
      ownerAddress: string;
      winsNanoerg: number;
      placesNanoerg: number;
      showsNanoerg: number;
      totalNanoerg: number;
      shadow: boolean;
      txId: string | null;
    }>();

    let poolWinsTotal = 0;
    let poolPlacesTotal = 0;
    let poolShowsTotal = 0;

    for (const row of payoutRows) {
      const key = row.creature_id;
      if (!creaturePayouts.has(key)) {
        creaturePayouts.set(key, {
          creatureId: row.creature_id,
          ownerAddress: row.owner_address,
          winsNanoerg: 0,
          placesNanoerg: 0,
          showsNanoerg: 0,
          totalNanoerg: 0,
          shadow: row.shadow ?? true,
          txId: row.tx_id ?? null,
        });
      }

      const entry = creaturePayouts.get(key)!;
      const pool = row.memo?.match(POOL_RE)?.[1];
      const amt = row.amount_nanoerg ?? 0;

      if (pool === 'wins') {
        entry.winsNanoerg += amt;
        poolWinsTotal += amt;
      } else if (pool === 'places') {
        entry.placesNanoerg += amt;
        poolPlacesTotal += amt;
      } else if (pool === 'shows') {
        entry.showsNanoerg += amt;
        poolShowsTotal += amt;
      }
      entry.totalNanoerg += amt;
    }

    // 6. Build response
    const creatures = [...creaturePayouts.values()]
      .sort((a, b) => b.totalNanoerg - a.totalNanoerg)
      .map(cp => {
        const info = creatureInfoMap.get(cp.creatureId);
        const standing = standingsMap.get(cp.creatureId);
        return {
          creatureId: cp.creatureId,
          creatureName: info?.name ?? 'Unknown',
          imageUrl: info?.imageUrl ?? null,
          fallbackImageUrl: info?.fallbackImageUrl ?? null,
          ownerAddress: cp.ownerAddress,
          ownerDisplayName: displayNames[cp.ownerAddress] ?? null,
          wins: standing?.wins ?? 0,
          places: standing?.places ?? 0,
          shows: standing?.shows ?? 0,
          racesEntered: standing?.racesEntered ?? 0,
          winsPayoutErg: nanoErgToErg(cp.winsNanoerg),
          placesPayoutErg: nanoErgToErg(cp.placesNanoerg),
          showsPayoutErg: nanoErgToErg(cp.showsNanoerg),
          totalPayoutErg: nanoErgToErg(cp.totalNanoerg),
          shadow: cp.shadow,
          txId: cp.txId,
        };
      });

    const totalNanoerg = poolWinsTotal + poolPlacesTotal + poolShowsTotal;

    return res.status(200).json({
      seasonId,
      totalPayoutsErg: nanoErgToErg(totalNanoerg),
      uniqueWallets: new Set(payoutRows.map(r => r.owner_address)).size,
      payoutCount: payoutRows.length,
      pools: {
        wins: { totalErg: nanoErgToErg(poolWinsTotal), percentage: 40 },
        places: { totalErg: nanoErgToErg(poolPlacesTotal), percentage: 35 },
        shows: { totalErg: nanoErgToErg(poolShowsTotal), percentage: 25 },
      },
      creatures,
    });
  } catch (err) {
    console.error('GET /api/v2/admin/seasons/[seasonId]/payouts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

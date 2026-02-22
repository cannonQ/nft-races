import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { nanoErgToErg } from '../../_lib/constants.js';
import { getGameConfig } from '../../_lib/config.js';

const FEE_TX_TYPES = ['training_fee', 'race_entry_fee', 'treatment_fee'];

/** Compute live prize pool from credit_ledger for a season */
async function computePrizePool(seasonId: string) {
  const { data: rows } = await supabase
    .from('credit_ledger')
    .select('amount_nanoerg, fee_token_id, fee_token_amount')
    .eq('season_id', seasonId)
    .in('tx_type', FEE_TX_TYPES)
    .lt('amount_nanoerg', 0);

  let ergNanoTotal = 0;
  let tokenTotal = 0;
  for (const r of rows ?? []) {
    if (r.fee_token_id) {
      tokenTotal += Math.abs(r.fee_token_amount ?? 0);
    } else {
      ergNanoTotal += Math.abs(r.amount_nanoerg ?? 0);
    }
  }
  return { ergNanoTotal, tokenTotal };
}

async function mapSeason(data: any) {
  const pool = await computePrizePool(data.id);

  // Look up token name from collection config
  let tokenName: string | null = null;
  if (pool.tokenTotal > 0 && data.collection_id) {
    const config = await getGameConfig(data.collection_id);
    tokenName = config?.fee_token?.name ?? null;
  }

  return {
    id: data.id,
    name: data.name,
    seasonNumber: data.season_number ?? 1,
    collectionId: data.collection_id,
    collectionName: data.collections?.name ?? null,
    modifier: data.modifier ?? { theme: '', description: '' },
    startDate: data.start_date,
    endDate: data.end_date,
    prizePool: nanoErgToErg(pool.ergNanoTotal),
    prizePoolNanoerg: pool.ergNanoTotal,
    prizePoolToken: pool.tokenTotal > 0 ? pool.tokenTotal : null,
    prizePoolTokenName: tokenName,
    status: data.status,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const collectionId = req.query.collectionId as string | undefined;

    // If collectionId specified, return single season for that collection
    if (collectionId) {
      const { data, error } = await supabase
        .from('seasons')
        .select('*, collections(name)')
        .eq('status', 'active')
        .eq('collection_id', collectionId)
        .limit(1)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'No active season for this collection' });
      }

      return res.status(200).json(await mapSeason(data));
    }

    // No filter: return all active seasons
    const { data, error } = await supabase
      .from('seasons')
      .select('*, collections(name)')
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch seasons' });
    }

    const seasons = await Promise.all((data ?? []).map(mapSeason));

    // Backward compat: if exactly one season, return it as object
    if (seasons.length === 1) {
      return res.status(200).json(seasons[0]);
    }

    // Zero or multiple: return array
    if (seasons.length === 0) {
      return res.status(404).json({ error: 'No active season' });
    }

    return res.status(200).json(seasons);
  } catch (err) {
    console.error('GET /api/v2/seasons/current error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

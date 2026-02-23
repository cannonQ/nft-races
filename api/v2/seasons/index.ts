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

/**
 * GET /api/v2/seasons
 * Public listing of all seasons (active + completed).
 * Optional query params:
 *   ?status=active|completed  — filter by status
 *   ?collectionId=UUID        — filter by collection
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const status = req.query.status as string | undefined;
    const collectionId = req.query.collectionId as string | undefined;

    let query = supabase
      .from('seasons')
      .select('*, collections(name)')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    } else {
      // Exclude upcoming by default — only show active + completed
      query = query.in('status', ['active', 'completed']);
    }

    if (collectionId) {
      query = query.eq('collection_id', collectionId);
    }

    const { data: seasons, error } = await query;

    if (error) {
      console.error('GET /api/v2/seasons error:', error);
      return res.status(500).json({ error: 'Failed to fetch seasons' });
    }

    const mapped = await Promise.all((seasons ?? []).map(async (s: any) => {
      // Active seasons: compute live prize pool from ledger (column is 0 until season ends)
      if (s.status === 'active') {
        const pool = await computePrizePool(s.id);
        let tokenName: string | null = null;
        if (pool.tokenTotal > 0 && s.collection_id) {
          const config = await getGameConfig(s.collection_id);
          tokenName = config?.fee_token?.name ?? null;
        }
        return {
          id: s.id,
          name: s.name,
          seasonNumber: s.season_number,
          collectionId: s.collection_id,
          collectionName: s.collections?.name ?? null,
          status: s.status,
          modifier: s.modifier ?? { theme: '', description: '' },
          prizePool: nanoErgToErg(pool.ergNanoTotal),
          prizePoolNanoerg: pool.ergNanoTotal,
          prizePoolToken: pool.tokenTotal > 0 ? pool.tokenTotal : null,
          prizePoolTokenName: tokenName,
          startDate: s.start_date,
          endDate: s.end_date,
          createdAt: s.created_at,
        };
      }

      // Completed seasons: use stored column value
      return {
        id: s.id,
        name: s.name,
        seasonNumber: s.season_number,
        collectionId: s.collection_id,
        collectionName: s.collections?.name ?? null,
        status: s.status,
        modifier: s.modifier ?? { theme: '', description: '' },
        prizePool: nanoErgToErg(s.prize_pool_nanoerg ?? 0),
        prizePoolNanoerg: s.prize_pool_nanoerg ?? 0,
        startDate: s.start_date,
        endDate: s.end_date,
        createdAt: s.created_at,
      };
    }));

    return res.status(200).json(mapped);
  } catch (err) {
    console.error('GET /api/v2/seasons error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

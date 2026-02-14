import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { nanoErgToErg } from '../../../_lib/constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const {
      collectionId,
      name,
      modifier,
      prizePoolNanoerg = 0,
      durationDays = 30,
    } = req.body ?? {};

    if (!collectionId) {
      return res.status(400).json({ error: 'collectionId is required' });
    }

    // Check no active season exists for this collection
    const { data: existingSeason } = await supabase
      .from('seasons')
      .select('id')
      .eq('collection_id', collectionId)
      .eq('status', 'active')
      .limit(1);

    if (existingSeason && existingSeason.length > 0) {
      return res.status(400).json({
        error: 'An active season already exists for this collection. End it first.',
      });
    }

    // Determine season number
    const { count: previousSeasons } = await supabase
      .from('seasons')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId);

    const seasonNumber = (previousSeasons ?? 0) + 1;

    // Create new season
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const { data: season, error: seasonErr } = await supabase
      .from('seasons')
      .insert({
        name: name ?? `Season ${seasonNumber}`,
        collection_id: collectionId,
        season_number: seasonNumber,
        status: 'active',
        modifier: modifier ?? { theme: 'standard', description: 'Standard season' },
        prize_pool_nanoerg: prizePoolNanoerg,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })
      .select('*')
      .single();

    if (seasonErr || !season) {
      return res.status(500).json({ error: 'Failed to create season' });
    }

    // Lazy init: creature_stats rows are created on first interaction
    // (training, race entry, profile view) via getOrCreateCreatureStats().
    // This scales to any collection size — no batch init needed.
    // For 450 CyberPets this was already slow (~900 DB calls).
    // For 4400+ Aneta Angels it would guarantee a Vercel timeout.

    // Count registered creatures for the response (informational only)
    const { count: creatureCount } = await supabase
      .from('creatures')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collectionId);

    return res.status(200).json({
      success: true,
      season: {
        id: season.id,
        name: season.name,
        seasonNumber: season.season_number,
        startDate: season.start_date,
        endDate: season.end_date,
        prizePool: nanoErgToErg(season.prize_pool_nanoerg ?? 0),
        status: season.status,
        registeredCreatures: creatureCount ?? 0,
      },
    });
  } catch (err) {
    console.error('POST /api/v2/admin/seasons/start error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

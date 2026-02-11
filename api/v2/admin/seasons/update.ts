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
    const { seasonId, name, modifier, prizePoolNanoerg, endDate } = req.body ?? {};

    if (!seasonId) {
      return res.status(400).json({ error: 'seasonId is required' });
    }

    // Fetch current season
    const { data: season, error: fetchErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .single();

    if (fetchErr || !season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    if (season.status === 'completed' || season.status === 'paying_out') {
      return res.status(400).json({ error: `Cannot edit a ${season.status} season` });
    }

    // Build update payload — only include fields that were provided
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (modifier !== undefined) updates.modifier = modifier;
    if (prizePoolNanoerg !== undefined) updates.prize_pool_nanoerg = prizePoolNanoerg;
    if (endDate !== undefined) updates.end_date = endDate;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('seasons')
      .update(updates)
      .eq('id', seasonId)
      .select('*')
      .single();

    if (updateErr || !updated) {
      console.error('Season update error:', updateErr);
      return res.status(500).json({ error: 'Failed to update season' });
    }

    return res.status(200).json({
      success: true,
      season: {
        id: updated.id,
        name: updated.name,
        seasonNumber: updated.season_number,
        status: updated.status,
        modifier: updated.modifier,
        prizePool: nanoErgToErg(updated.prize_pool_nanoerg ?? 0),
        prizePoolNanoerg: updated.prize_pool_nanoerg ?? 0,
        startDate: updated.start_date,
        endDate: updated.end_date,
      },
    });
  } catch (err) {
    console.error('POST /api/v2/admin/seasons/update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase';
import { requireAdmin } from '../../../_lib/auth';
import { nanoErgToErg } from '../../../_lib/constants';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const { raceId, name, raceType, entryDeadline, maxEntries } = req.body ?? {};

    if (!raceId) {
      return res.status(400).json({ error: 'raceId is required' });
    }

    // Verify race exists and is still open
    const { data: existing, error: fetchErr } = await supabase
      .from('season_races')
      .select('id, status')
      .eq('id', raceId)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Race not found' });
    }

    if (existing.status !== 'open') {
      return res.status(400).json({ error: `Cannot edit a race with status "${existing.status}"` });
    }

    // Build update payload with only provided fields
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (raceType !== undefined) updates.race_type = raceType;
    if (entryDeadline !== undefined) updates.entry_deadline = entryDeadline;
    if (maxEntries !== undefined) updates.max_entries = maxEntries;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: race, error: updateErr } = await supabase
      .from('season_races')
      .update(updates)
      .eq('id', raceId)
      .select('*')
      .single();

    if (updateErr || !race) {
      console.error('Race update error:', updateErr);
      return res.status(500).json({ error: 'Failed to update race' });
    }

    return res.status(200).json({
      success: true,
      race: {
        id: race.id,
        name: race.name,
        raceType: race.race_type,
        entryFee: nanoErgToErg(race.entry_fee_nanoerg ?? 0),
        maxEntries: race.max_entries,
        entryDeadline: race.entry_deadline,
        status: race.status,
      },
    });
  } catch (err) {
    console.error('POST /api/v2/admin/races/update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

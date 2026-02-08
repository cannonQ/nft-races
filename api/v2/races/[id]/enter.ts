import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase';
import { getUtcMidnightToday } from '../../../_lib/helpers';
import { applyConditionDecay } from '../../../../lib/training-engine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const raceId = req.query.id as string;
  const { creatureId, walletAddress } = req.body ?? {};

  if (!raceId || !creatureId || !walletAddress) {
    return res.status(400).json({ error: 'raceId, creatureId, and walletAddress are required' });
  }

  try {
    // 1. Verify creature exists and ownership matches
    const { data: creature, error: creatureErr } = await supabase
      .from('creatures')
      .select('id, token_id, owner_address, base_stats')
      .eq('id', creatureId)
      .single();

    if (creatureErr || !creature) {
      return res.status(400).json({ error: 'Creature not found' });
    }

    if (creature.owner_address !== walletAddress) {
      return res.status(400).json({ error: 'Wallet address does not match creature owner' });
    }

    // 2. Verify race exists and is open
    const { data: race, error: raceErr } = await supabase
      .from('season_races')
      .select('*')
      .eq('id', raceId)
      .single();

    if (raceErr || !race) {
      return res.status(400).json({ error: 'Race not found' });
    }

    if (race.status !== 'open') {
      return res.status(400).json({ error: `Race is not open (status: ${race.status})` });
    }

    if (new Date(race.entry_deadline) < new Date()) {
      return res.status(400).json({ error: 'Race entry deadline has passed' });
    }

    // 3. Verify entry count < max_entries
    const { count: entryCount } = await supabase
      .from('season_race_entries')
      .select('*', { count: 'exact', head: true })
      .eq('race_id', raceId);

    if ((entryCount ?? 0) >= race.max_entries) {
      return res.status(400).json({ error: 'Race is full' });
    }

    // 4. Verify creature not already entered
    const { data: existing } = await supabase
      .from('season_race_entries')
      .select('id')
      .eq('race_id', raceId)
      .eq('creature_id', creatureId)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Creature is already entered in this race' });
    }

    // 5. Fetch creature_stats for this season
    const { data: stats, error: statsErr } = await supabase
      .from('creature_stats')
      .select('*')
      .eq('creature_id', creatureId)
      .eq('season_id', race.season_id)
      .single();

    if (statsErr || !stats) {
      return res.status(400).json({ error: 'Creature stats not found for this season' });
    }

    // 6. Verify creature hasn't raced today (UTC)
    if (stats.last_race_at) {
      const todayStart = getUtcMidnightToday();
      if (new Date(stats.last_race_at) >= new Date(todayStart)) {
        return res.status(400).json({ error: 'Creature has already raced today' });
      }
    }

    // 7. Snapshot current stats with real-time condition decay
    const { fatigue, sharpness } = applyConditionDecay(
      stats.fatigue ?? 0,
      stats.sharpness ?? 50,
      stats.last_action_at,
    );

    const snapshotStats = {
      speed: stats.speed ?? 0,
      stamina: stats.stamina ?? 0,
      accel: stats.accel ?? 0,
      agility: stats.agility ?? 0,
      heart: stats.heart ?? 0,
      focus: stats.focus ?? 0,
    };

    // 8. Insert entry
    const { data: entry, error: insertErr } = await supabase
      .from('season_race_entries')
      .insert({
        race_id: raceId,
        creature_id: creatureId,
        owner_address: walletAddress,
        snapshot_stats: snapshotStats,
        snapshot_base_stats: creature.base_stats,
        snapshot_fatigue: Math.round(fatigue * 100) / 100,
        snapshot_sharpness: Math.round(sharpness * 100) / 100,
      })
      .select('id')
      .single();

    if (insertErr || !entry) {
      return res.status(500).json({ error: 'Failed to create race entry' });
    }

    // 9. Update creature_stats: last_race_at and race_count
    await supabase
      .from('creature_stats')
      .update({
        last_race_at: new Date().toISOString(),
        race_count: (stats.race_count ?? 0) + 1,
      })
      .eq('creature_id', creatureId)
      .eq('season_id', race.season_id);

    return res.status(200).json({ success: true, entryId: entry.id });
  } catch (err) {
    console.error('POST /api/v2/races/[id]/enter error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

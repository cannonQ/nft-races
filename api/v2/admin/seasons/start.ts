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

    // Fetch all creatures in this collection
    const { data: creatures, error: creaturesErr } = await supabase
      .from('creatures')
      .select('id')
      .eq('collection_id', collectionId);

    if (creaturesErr) {
      return res.status(500).json({ error: 'Failed to fetch creatures for collection' });
    }

    const creatureIds = (creatures ?? []).map((c: any) => c.id);

    // Initialize creature_stats for all creatures (batch in chunks of 500)
    if (creatureIds.length > 0) {
      const statsInserts = creatureIds.map((creatureId: string) => ({
        creature_id: creatureId,
        season_id: season.id,
        speed: 0,
        stamina: 0,
        accel: 0,
        agility: 0,
        heart: 0,
        focus: 0,
        fatigue: 0,
        sharpness: 50,
        bonus_actions: 0,
        boost_multiplier: 0,
        action_count: 0,
        race_count: 0,
      }));

      for (let i = 0; i < statsInserts.length; i += 500) {
        const chunk = statsInserts.slice(i, i + 500);
        const { error: insertErr } = await supabase
          .from('creature_stats')
          .insert(chunk);
        if (insertErr) {
          console.error(`Failed to insert creature_stats chunk ${i}:`, insertErr);
        }
      }

      // Increment prestige.total_seasons for each creature
      for (let i = 0; i < creatureIds.length; i += 500) {
        const chunk = creatureIds.slice(i, i + 500);
        // Use individual updates since Supabase doesn't support increment on bulk IN
        for (const cId of chunk) {
          const { data: current } = await supabase
            .from('prestige')
            .select('total_seasons')
            .eq('creature_id', cId)
            .single();

          if (current) {
            await supabase
              .from('prestige')
              .update({ total_seasons: (current.total_seasons ?? 0) + 1 })
              .eq('creature_id', cId);
          } else {
            // Create prestige row if it doesn't exist
            await supabase
              .from('prestige')
              .insert({
                creature_id: cId,
                total_seasons: 1,
                lifetime_wins: 0,
                lifetime_places: 0,
                lifetime_shows: 0,
                lifetime_races: 0,
                lifetime_earnings_nanoerg: 0,
                badges: [],
              });
          }
        }
      }
    }

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
        creaturesInitialized: creatureIds.length,
      },
    });
  } catch (err) {
    console.error('POST /api/v2/admin/seasons/start error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

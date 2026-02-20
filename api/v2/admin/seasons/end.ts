import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { nanoErgToErg } from '../../../_lib/constants.js';
import { recordLedgerEntry } from '../../../_lib/credit-ledger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const { seasonId } = req.body ?? {};
    if (!seasonId) {
      return res.status(400).json({ error: 'seasonId is required' });
    }

    // Fetch season
    const { data: season, error: seasonErr } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .single();

    if (seasonErr || !season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    if (season.status !== 'active') {
      return res.status(400).json({ error: `Season is not active (status: ${season.status})` });
    }

    // 1. Mark season as paying_out
    await supabase
      .from('seasons')
      .update({ status: 'paying_out' })
      .eq('id', seasonId);

    // 2. Cancel any remaining open races
    await supabase
      .from('season_races')
      .update({ status: 'cancelled' })
      .eq('season_id', seasonId)
      .in('status', ['open', 'upcoming']);

    // 3. Read full leaderboard (used for prestige — counts ALL races)
    const { data: standings } = await supabase
      .from('season_leaderboard')
      .select('*')
      .eq('season_id', seasonId)
      .order('wins', { ascending: false })
      .order('places', { ascending: false })
      .order('shows', { ascending: false });

    // 3b. Fetch individual open-race finishes for per-race payout distribution.
    // Class races award recovery rewards, not prize money.
    // Each 1st/2nd/3rd finish in an open race generates its own traceable payout entry.
    const { data: openRaceEntries } = await supabase
      .from('season_race_entries')
      .select('creature_id, owner_address, finish_position, race_id, season_races!inner(rarity_class)')
      .eq('season_races.season_id', seasonId)
      .eq('season_races.status', 'resolved')
      .is('season_races.rarity_class', null)
      .not('finish_position', 'is', null);

    // 4. Compute prize pool payouts — per-race entries (each finish → its own ledger row with race_id)
    const prizePool = season.prize_pool_nanoerg ?? 0;
    const payouts: { ownerAddress: string; amount: number; pool: string; creatureId: string; raceId: string }[] = [];

    const finishes = openRaceEntries ?? [];
    if (prizePool > 0 && finishes.length > 0) {
      const winPool = Math.floor(prizePool * 0.40);
      const placePool = Math.floor(prizePool * 0.35);
      const showPool = Math.floor(prizePool * 0.25);

      const totalWins = finishes.filter(e => e.finish_position === 1).length;
      const totalPlaces = finishes.filter(e => e.finish_position === 2).length;
      const totalShows = finishes.filter(e => e.finish_position === 3).length;

      const perWinShare = totalWins > 0 ? Math.floor(winPool / totalWins) : 0;
      const perPlaceShare = totalPlaces > 0 ? Math.floor(placePool / totalPlaces) : 0;
      const perShowShare = totalShows > 0 ? Math.floor(showPool / totalShows) : 0;

      for (const e of finishes) {
        let amount = 0;
        let pool = '';
        if (e.finish_position === 1 && perWinShare > 0) { amount = perWinShare; pool = 'wins'; }
        else if (e.finish_position === 2 && perPlaceShare > 0) { amount = perPlaceShare; pool = 'places'; }
        else if (e.finish_position === 3 && perShowShare > 0) { amount = perShowShare; pool = 'shows'; }

        if (amount > 0) {
          payouts.push({
            ownerAddress: e.owner_address,
            amount,
            pool,
            creatureId: e.creature_id,
            raceId: e.race_id,
          });
        }
      }
    }

    // 4b. Shadow billing: record season payouts (must await in serverless)
    for (const p of payouts) {
      await recordLedgerEntry({
        ownerAddress: p.ownerAddress,
        txType: 'season_payout',
        amountNanoerg: p.amount,
        creatureId: p.creatureId,
        raceId: p.raceId,
        seasonId,
        memo: `Season payout: ${p.pool} pool`,
      });
    }

    // 5. Update prestige for each creature that participated
    if (standings && standings.length > 0) {
      for (const s of standings) {
        // Sum this creature's payouts
        const creaturePayouts = payouts
          .filter(p => p.creatureId === s.creature_id)
          .reduce((sum, p) => sum + p.amount, 0);

        const { data: current } = await supabase
          .from('prestige')
          .select('*')
          .eq('creature_id', s.creature_id)
          .single();

        if (current) {
          await supabase
            .from('prestige')
            .update({
              lifetime_wins: (current.lifetime_wins ?? 0) + (s.wins ?? 0),
              lifetime_places: (current.lifetime_places ?? 0) + (s.places ?? 0),
              lifetime_shows: (current.lifetime_shows ?? 0) + (s.shows ?? 0),
              lifetime_races: (current.lifetime_races ?? 0) + (s.races_entered ?? 0),
              lifetime_earnings_nanoerg: (current.lifetime_earnings_nanoerg ?? 0) + (s.total_earnings_nanoerg ?? 0) + creaturePayouts,
            })
            .eq('creature_id', s.creature_id);
        }
      }
    }

    // 6. Mark season as completed
    await supabase
      .from('seasons')
      .update({
        status: 'completed',
        end_date: new Date().toISOString(),
      })
      .eq('id', seasonId);

    return res.status(200).json({
      success: true,
      payouts: payouts.map(p => ({
        ownerAddress: p.ownerAddress,
        amount: nanoErgToErg(p.amount),
        amountNanoerg: p.amount,
        pool: p.pool,
        creatureId: p.creatureId,
        raceId: p.raceId,
      })),
    });
  } catch (err) {
    console.error('POST /api/v2/admin/seasons/end error:', err);
    // Try to revert season status if something went wrong
    const { seasonId } = req.body ?? {};
    if (seasonId) {
      await supabase
        .from('seasons')
        .update({ status: 'active' })
        .eq('id', seasonId)
        .eq('status', 'paying_out');
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

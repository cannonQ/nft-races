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

    // 3. Read leaderboard
    const { data: standings } = await supabase
      .from('season_leaderboard')
      .select('*')
      .eq('season_id', seasonId)
      .order('wins', { ascending: false })
      .order('places', { ascending: false })
      .order('shows', { ascending: false });

    // 4. Compute prize pool payouts
    const prizePool = season.prize_pool_nanoerg ?? 0;
    const payouts: { ownerAddress: string; amount: number; pool: string; creatureId: string }[] = [];

    if (prizePool > 0 && standings && standings.length > 0) {
      const winPool = Math.floor(prizePool * 0.40);
      const placePool = Math.floor(prizePool * 0.35);
      const showPool = Math.floor(prizePool * 0.25);

      // Win pool: distribute to creatures with wins, proportional to win count
      const winnersWithWins = standings.filter((s: any) => (s.wins ?? 0) > 0);
      const totalWins = winnersWithWins.reduce((sum: number, s: any) => sum + (s.wins ?? 0), 0);
      if (totalWins > 0) {
        for (const s of winnersWithWins) {
          const share = Math.floor(winPool * ((s.wins ?? 0) / totalWins));
          if (share > 0) {
            payouts.push({
              ownerAddress: s.owner_address,
              amount: share,
              pool: 'wins',
              creatureId: s.creature_id,
            });
          }
        }
      }

      // Place pool: distribute to creatures with places, proportional
      const withPlaces = standings.filter((s: any) => (s.places ?? 0) > 0);
      const totalPlaces = withPlaces.reduce((sum: number, s: any) => sum + (s.places ?? 0), 0);
      if (totalPlaces > 0) {
        for (const s of withPlaces) {
          const share = Math.floor(placePool * ((s.places ?? 0) / totalPlaces));
          if (share > 0) {
            payouts.push({
              ownerAddress: s.owner_address,
              amount: share,
              pool: 'places',
              creatureId: s.creature_id,
            });
          }
        }
      }

      // Show pool: distribute to creatures with shows, proportional
      const withShows = standings.filter((s: any) => (s.shows ?? 0) > 0);
      const totalShows = withShows.reduce((sum: number, s: any) => sum + (s.shows ?? 0), 0);
      if (totalShows > 0) {
        for (const s of withShows) {
          const share = Math.floor(showPool * ((s.shows ?? 0) / totalShows));
          if (share > 0) {
            payouts.push({
              ownerAddress: s.owner_address,
              amount: share,
              pool: 'shows',
              creatureId: s.creature_id,
            });
          }
        }
      }
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

/**
 * POST /api/v2/races/resolve
 *
 * Resolve a season race: compute results using the v2 training engine,
 * record results, and apply race reward boosts to creature_stats.
 *
 * Body: { raceId: string, blockHash: string }
 *
 * The blockHash should come from a recent Ergo block for deterministic,
 * verifiable RNG seeding.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  computeRaceResult,
  applyRaceRewards,
  type RaceEntry,
  type Stats,
  STAT_KEYS,
} from '@/lib/training-engine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { raceId, blockHash } = body as {
      raceId?: string;
      blockHash?: string;
    };

    if (!raceId || !blockHash) {
      return NextResponse.json(
        { error: 'Missing required fields: raceId, blockHash' },
        { status: 400 },
      );
    }

    // --- Fetch race ----------------------------------------------------------
    const { data: race, error: raceErr } = await supabase
      .from('season_races')
      .select('*')
      .eq('id', raceId)
      .single();

    if (raceErr || !race) {
      return NextResponse.json({ error: 'Race not found' }, { status: 404 });
    }

    if (race.status !== 'open' && race.status !== 'closed') {
      return NextResponse.json(
        { error: `Race already resolved (status: ${race.status})` },
        { status: 400 },
      );
    }

    // --- Fetch entries -------------------------------------------------------
    const { data: entries, error: entriesErr } = await supabase
      .from('season_race_entries')
      .select('*, creatures(id, base_stats)')
      .eq('race_id', raceId);

    if (entriesErr || !entries || entries.length < 2) {
      return NextResponse.json(
        { error: `Not enough entries (need >= 2, got ${entries?.length ?? 0})` },
        { status: 400 },
      );
    }

    const seasonId = race.season_id;

    // --- Fetch game config ---------------------------------------------------
    const { data: config, error: configErr } = await supabase
      .from('game_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (configErr || !config) {
      return NextResponse.json({ error: 'Game config not found' }, { status: 500 });
    }

    // --- Build race entry objects with creature stats -------------------------
    const raceEntries: RaceEntry[] = [];

    for (const entry of entries) {
      // Fetch creature_stats for this season
      const { data: stats } = await supabase
        .from('creature_stats')
        .select('*')
        .eq('creature_id', entry.creature_id)
        .eq('season_id', seasonId)
        .single();

      const baseStats: Stats = entry.creatures?.base_stats ?? {
        speed: 0, stamina: 0, accel: 0, agility: 0, heart: 0, focus: 0,
      };

      const trainedStats: Stats = {
        speed: stats?.speed ?? 0,
        stamina: stats?.stamina ?? 0,
        accel: stats?.accel ?? 0,
        agility: stats?.agility ?? 0,
        heart: stats?.heart ?? 0,
        focus: stats?.focus ?? 0,
      };

      raceEntries.push({
        creatureId: entry.creature_id,
        baseStats,
        trainedStats,
        fatigue: stats?.fatigue ?? 0,
        sharpness: stats?.sharpness ?? 50,
      });
    }

    // --- Compute race results ------------------------------------------------
    const raceType = race.race_type || 'standard';
    const { results } = computeRaceResult(raceEntries, raceType, blockHash, config);

    // --- Update race status --------------------------------------------------
    await supabase
      .from('season_races')
      .update({
        status: 'resolved',
        block_hash: blockHash,
        resolved_at: new Date().toISOString(),
        results,
      })
      .eq('id', raceId);

    // --- Update entries with positions ---------------------------------------
    for (const result of results) {
      await supabase
        .from('season_race_entries')
        .update({
          position: result.position,
          performance_score: result.performanceScore,
          payout: result.payout,
        })
        .eq('race_id', raceId)
        .eq('creature_id', result.creatureId);
    }

    // --- Apply race reward boosts to creature_stats --------------------------
    await applyRaceRewards(results, seasonId, supabase);

    // --- Update season leaderboard -------------------------------------------
    for (const result of results) {
      // Upsert leaderboard row
      const { data: existing } = await supabase
        .from('season_leaderboard')
        .select('id, races_entered, wins, podiums, total_score')
        .eq('creature_id', result.creatureId)
        .eq('season_id', seasonId)
        .single();

      if (existing) {
        await supabase
          .from('season_leaderboard')
          .update({
            races_entered: existing.races_entered + 1,
            wins: existing.wins + (result.position === 1 ? 1 : 0),
            podiums: existing.podiums + (result.position <= 3 ? 1 : 0),
            total_score: existing.total_score + result.performanceScore,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('season_leaderboard').insert({
          creature_id: result.creatureId,
          season_id: seasonId,
          races_entered: 1,
          wins: result.position === 1 ? 1 : 0,
          podiums: result.position <= 3 ? 1 : 0,
          total_score: result.performanceScore,
        });
      }
    }

    // --- Update prestige (lifetime stats) ------------------------------------
    for (const result of results) {
      const { data: prestige } = await supabase
        .from('prestige')
        .select('id, total_races, total_wins, total_podiums, total_earnings')
        .eq('creature_id', result.creatureId)
        .single();

      if (prestige) {
        await supabase
          .from('prestige')
          .update({
            total_races: prestige.total_races + 1,
            total_wins: prestige.total_wins + (result.position === 1 ? 1 : 0),
            total_podiums: prestige.total_podiums + (result.position <= 3 ? 1 : 0),
            total_earnings: prestige.total_earnings + result.payout,
          })
          .eq('id', prestige.id);
      }
    }

    return NextResponse.json({
      success: true,
      raceId,
      raceType,
      blockHash,
      results,
      rewards: results.map((r) => ({
        creatureId: r.creatureId,
        position: r.position,
        bonusActions: r.position === 1 ? 1 : 0,
        boostMultiplier:
          r.position === 1 ? 0 :
          r.position === 2 ? 0.50 :
          r.position === 3 ? 0.25 : 0.10,
      })),
    });
  } catch (err: any) {
    console.error('Race resolution error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

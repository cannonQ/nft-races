/**
 * POST /api/v2/train
 *
 * Training endpoint for the CyberPets seasonal training system.
 * Honor-system phase: validates wallet owns the creature but skips
 * cryptographic signature verification.
 *
 * Body: { creatureId: string, activity: string, walletAddress: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  validateTrainingAction,
  computeTrainingGains,
  applyConditionDecay,
  STAT_KEYS,
  type Stats,
} from '@/lib/training-engine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const VALID_ACTIVITIES = [
  'sprint_drills',
  'distance_runs',
  'agility_course',
  'gate_work',
  'cross_training',
  'mental_prep',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creatureId, activity, walletAddress } = body as {
      creatureId?: string;
      activity?: string;
      walletAddress?: string;
    };

    // --- Basic validation ---------------------------------------------------
    if (!creatureId || !activity || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: creatureId, activity, walletAddress' },
        { status: 400 },
      );
    }

    if (!VALID_ACTIVITIES.includes(activity)) {
      return NextResponse.json(
        { error: `Invalid activity. Must be one of: ${VALID_ACTIVITIES.join(', ')}` },
        { status: 400 },
      );
    }

    // --- Ownership check (honor system) -------------------------------------
    const { data: creature, error: creatureErr } = await supabase
      .from('creatures')
      .select('id, token_id, owner_address')
      .eq('id', creatureId)
      .single();

    if (creatureErr || !creature) {
      return NextResponse.json({ error: 'Creature not found' }, { status: 404 });
    }

    if (creature.owner_address !== walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address does not match creature owner' },
        { status: 403 },
      );
    }

    // --- Fetch game_config --------------------------------------------------
    const { data: config, error: configErr } = await supabase
      .from('game_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (configErr || !config) {
      return NextResponse.json({ error: 'Game config not found' }, { status: 500 });
    }

    // --- Find the active season ---------------------------------------------
    const { data: activeSeason, error: seasonErr } = await supabase
      .from('seasons')
      .select('id')
      .eq('status', 'active')
      .single();

    if (seasonErr || !activeSeason) {
      return NextResponse.json({ error: 'No active season found' }, { status: 400 });
    }

    const seasonId = activeSeason.id;

    // --- Validate training action -------------------------------------------
    const validation = await validateTrainingAction(creatureId, seasonId, supabase);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    // --- Fetch full creature_stats row for decay calc -----------------------
    const { data: statsRow, error: statsErr } = await supabase
      .from('creature_stats')
      .select('*')
      .eq('creature_id', creatureId)
      .eq('season_id', seasonId)
      .single();

    if (statsErr || !statsRow) {
      return NextResponse.json({ error: 'Creature stats not found' }, { status: 404 });
    }

    // --- Apply condition decay first ----------------------------------------
    const decayed = applyConditionDecay(
      statsRow.fatigue ?? 0,
      statsRow.sharpness ?? 50,
      statsRow.last_action_at,
    );

    const currentStats: Stats = {
      speed: statsRow.speed ?? 0,
      stamina: statsRow.stamina ?? 0,
      accel: statsRow.accel ?? 0,
      agility: statsRow.agility ?? 0,
      heart: statsRow.heart ?? 0,
      focus: statsRow.focus ?? 0,
    };

    // --- Compute training gains ---------------------------------------------
    const gains = computeTrainingGains(activity, currentStats, config);

    // --- Build new stats ----------------------------------------------------
    const newStats: Stats = { ...currentStats };
    for (const key of STAT_KEYS) {
      if (gains.statChanges[key] !== undefined) {
        newStats[key] = Math.round((newStats[key] + gains.statChanges[key]!) * 100) / 100;
      }
    }

    const newFatigue = Math.min(100, Math.round((decayed.fatigue + gains.fatigueDelta) * 100) / 100);
    const newSharpness = Math.min(100, Math.round((decayed.sharpness + gains.sharpnessDelta) * 100) / 100);
    const now = new Date().toISOString();

    // --- Snapshot before/after for training_log -----------------------------
    const statsBefore = { ...currentStats, fatigue: statsRow.fatigue ?? 0, sharpness: statsRow.sharpness ?? 50 };
    const statsAfter = { ...newStats, fatigue: newFatigue, sharpness: newSharpness };

    // --- Update creature_stats ----------------------------------------------
    const { error: updateErr } = await supabase
      .from('creature_stats')
      .update({
        speed: newStats.speed,
        stamina: newStats.stamina,
        accel: newStats.accel,
        agility: newStats.agility,
        heart: newStats.heart,
        focus: newStats.focus,
        fatigue: newFatigue,
        sharpness: newSharpness,
        last_action_at: now,
        action_count: (statsRow.action_count ?? 0) + 1,
      })
      .eq('creature_id', creatureId)
      .eq('season_id', seasonId);

    if (updateErr) {
      return NextResponse.json(
        { error: `Failed to update stats: ${updateErr.message}` },
        { status: 500 },
      );
    }

    // --- Insert training_log ------------------------------------------------
    await supabase.from('training_log').insert({
      creature_id: creatureId,
      season_id: seasonId,
      activity,
      stats_before: statsBefore,
      stats_after: statsAfter,
      created_at: now,
    });

    // --- Response ------------------------------------------------------------
    const cooldownMs = 12 * 60 * 60 * 1000;
    const nextActionAt = new Date(Date.now() + cooldownMs).toISOString();

    return NextResponse.json({
      success: true,
      statChanges: gains.statChanges,
      newStats,
      fatigue: newFatigue,
      sharpness: newSharpness,
      nextActionAt,
    });
  } catch (err: any) {
    console.error('Training error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

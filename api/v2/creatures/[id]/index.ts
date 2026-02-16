import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { getActiveSeason, getLatestErgoBlock, countRegularActionsToday, getLastRegularActionAt, computeCreatureResponse } from '../../../_lib/helpers.js';
import { getLoaderBySlug } from '../../../_lib/collections/registry.js';
import { getGameConfig } from '../../../_lib/config.js';
import { checkAndCompleteTreatment } from '../../../_lib/execute-treatment.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'Creature ID is required' });
  }

  try {
    // Fetch creature
    const { data: creature, error: creatureErr } = await supabase
      .from('creatures')
      .select('*')
      .eq('id', id)
      .single();

    if (creatureErr || !creature) {
      return res.status(404).json({ error: 'Creature not found' });
    }

    // Look up collection loader for correct image/name resolution
    let loader;
    if (creature.collection_id) {
      const { data: col } = await supabase
        .from('collections')
        .select('name')
        .eq('id', creature.collection_id)
        .single();
      if (col) loader = getLoaderBySlug(col.name);
    }

    const season = await getActiveSeason(creature.collection_id);

    // Fetch stats, prestige, and current season leaderboard in parallel
    const [statsResult, prestigeResult, leaderboardResult] = await Promise.all([
      season
        ? supabase
            .from('creature_stats')
            .select('*')
            .eq('creature_id', id)
            .eq('season_id', season.id)
            .single()
        : { data: null },
      supabase
        .from('prestige')
        .select('*')
        .eq('creature_id', id)
        .single(),
      season
        ? supabase
            .from('season_leaderboard')
            .select('*')
            .eq('creature_id', id)
            .eq('season_id', season.id)
            .single()
        : { data: null },
    ]);

    const [regularActionsToday, lastRegularActionAt] = season && statsResult.data
      ? await Promise.all([
          countRegularActionsToday(id, season.id),
          getLastRegularActionAt(id, season.id),
        ])
      : [0, null];

    // Fetch available (unspent + unexpired) boost rewards and recovery rewards
    let availableBoosts: any[] = [];
    let availableRecoveries: any[] = [];
    if (season) {
      const { height: currentHeight } = await getLatestErgoBlock();
      const [{ data: boostRows }, { data: recoveryRows }] = await Promise.all([
        supabase
          .from('boost_rewards')
          .select('*')
          .eq('creature_id', id)
          .eq('season_id', season.id)
          .is('spent_at', null)
          .gt('expires_at_height', currentHeight),
        supabase
          .from('recovery_rewards')
          .select('*')
          .eq('creature_id', id)
          .eq('season_id', season.id)
          .is('consumed_at', null)
          .gt('expires_at_height', currentHeight),
      ]);
      availableBoosts = boostRows ?? [];
      availableRecoveries = recoveryRows ?? [];
    }

    const gameConfig = await getGameConfig(creature.collection_id) ?? undefined;

    // Lazy treatment completion: if treatment ended, apply effects before building response
    let statsData = statsResult.data ?? null;
    if (season && statsData?.treatment_type && statsData.treatment_ends_at) {
      const completed = await checkAndCompleteTreatment(id, season.id, gameConfig);
      if (completed) {
        // Re-fetch stats after treatment completion
        const { data: refreshed } = await supabase
          .from('creature_stats')
          .select('*')
          .eq('creature_id', id)
          .eq('season_id', season.id)
          .single();
        if (refreshed) statsData = refreshed;
      }
    }

    const result = computeCreatureResponse(
      creature,
      statsData,
      prestigeResult.data ?? null,
      regularActionsToday,
      availableBoosts,
      leaderboardResult.data ?? null,
      loader,
      lastRegularActionAt,
      gameConfig,
      availableRecoveries,
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/creatures/[id] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

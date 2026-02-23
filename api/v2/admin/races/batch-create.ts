import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { getActiveSeason } from '../../../_lib/helpers.js';
import { getGameConfig } from '../../../_lib/config.js';
import { DEFAULT_CLASS_WEIGHT, nanoErgToErg } from '../../../_lib/constants.js';
import { validateRaceType, validateRarityClass } from '../../../_lib/schedule-generator.js';
import type { GeneratedRace } from '../../../_lib/schedule-generator.js';

const MAX_BATCH_SIZE = 100;

/**
 * POST /api/v2/admin/races/batch-create
 *
 * Creates all races in a single DB insert.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdmin(req, res)) return;

  try {
    const { collectionId, seasonId, races } = req.body ?? {};

    if (!Array.isArray(races) || races.length === 0) {
      return res.status(400).json({ error: 'races array is required and must not be empty' });
    }
    if (races.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ error: `Maximum ${MAX_BATCH_SIZE} races per batch` });
    }

    // Resolve season
    let activeSeasonId = seasonId;
    let activeCollectionId = collectionId;

    if (!activeSeasonId) {
      const season = await getActiveSeason(collectionId ?? undefined);
      if (!season) {
        return res.status(400).json({
          error: collectionId
            ? 'No active season found for this collection'
            : 'No active season found. Specify a collectionId.',
        });
      }
      activeSeasonId = season.id;
      activeCollectionId = activeCollectionId ?? season.collection_id;
    }

    // Resolve default fees from game config
    let defaultFeeNanoerg = 0;
    let defaultFeeToken: number | null = null;

    if (activeCollectionId) {
      const config = await getGameConfig(activeCollectionId);
      defaultFeeNanoerg = config?.default_race_entry_fee_nanoerg ?? 0;
      const feeTokenConfig = config?.fee_token;
      if (feeTokenConfig?.default_race_entry_fee) {
        defaultFeeToken = feeTokenConfig.default_race_entry_fee;
      }
    }

    // Validate each race and build insert rows
    const insertRows: Record<string, any>[] = [];
    const validationErrors: string[] = [];

    for (let i = 0; i < races.length; i++) {
      const race = races[i] as GeneratedRace;
      const rowNum = i + 1;

      if (!race.name?.trim()) {
        validationErrors.push(`Race #${rowNum}: missing name`);
        continue;
      }
      if (!race.raceType || !validateRaceType(race.raceType)) {
        validationErrors.push(`Race #${rowNum}: invalid raceType "${race.raceType}"`);
        continue;
      }
      if (!race.entryDeadline || isNaN(new Date(race.entryDeadline).getTime())) {
        validationErrors.push(`Race #${rowNum}: invalid entryDeadline`);
        continue;
      }

      const maxEntries = race.maxEntries ?? 8;
      if (maxEntries < 2) {
        validationErrors.push(`Race #${rowNum}: maxEntries must be at least 2, got ${maxEntries}`);
        continue;
      }

      if (race.rarityClass && !validateRarityClass(race.rarityClass)) {
        validationErrors.push(`Race #${rowNum}: invalid rarityClass "${race.rarityClass}"`);
        continue;
      }

      const feeToken = race.entryFeeToken ?? defaultFeeToken;
      let feeNanoerg = race.entryFeeNanoerg;
      if (feeNanoerg === undefined) {
        // Auto-calculate proportional ERG when a custom token fee is set
        // Rate derived from: defaultFeeToken CYPX = defaultFeeNanoerg ERG
        if (feeToken && defaultFeeNanoerg > 0 && defaultFeeToken && defaultFeeToken > 0) {
          feeNanoerg = Math.round(feeToken * (defaultFeeNanoerg / defaultFeeToken));
        } else {
          feeNanoerg = defaultFeeNanoerg;
        }
      }

      insertRows.push({
        name: race.name.trim(),
        race_type: race.raceType,
        entry_deadline: race.entryDeadline,
        max_entries: maxEntries,
        entry_fee_nanoerg: feeNanoerg,
        entry_fee_token: feeToken,
        status: 'open',
        auto_resolve: race.autoResolve ?? true,
        season_id: activeSeasonId,
        collection_id: activeCollectionId,
        rarity_class: race.rarityClass || null,
        class_weight: race.rarityClass ? DEFAULT_CLASS_WEIGHT : 1.0,
        scheduled: true,
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
      });
    }

    if (insertRows.length === 0) {
      return res.status(400).json({ error: 'No valid races to create' });
    }

    // Single bulk insert
    const { data: created, error } = await supabase
      .from('season_races')
      .insert(insertRows)
      .select('*');

    if (error) {
      console.error('Batch insert error:', error);
      return res.status(500).json({ error: 'Failed to create races' });
    }

    return res.status(200).json({
      success: true,
      created: created?.length ?? 0,
      races: (created ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        raceType: r.race_type,
        entryFee: nanoErgToErg(r.entry_fee_nanoerg ?? 0),
        entryFeeToken: r.entry_fee_token ?? null,
        maxEntries: r.max_entries,
        entryDeadline: r.entry_deadline,
        status: r.status,
        autoResolve: r.auto_resolve ?? true,
        rarityClass: r.rarity_class ?? null,
        classWeight: r.class_weight ?? 1.0,
      })),
    });
  } catch (err) {
    console.error('POST /api/v2/admin/races/batch-create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

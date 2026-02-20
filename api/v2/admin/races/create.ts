import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { getActiveSeason } from '../../../_lib/helpers.js';
import { getGameConfig } from '../../../_lib/config.js';
import { nanoErgToErg, DEFAULT_CLASS_WEIGHT } from '../../../_lib/constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!requireAdmin(req, res)) return;

  try {
    const {
      name,
      raceType,
      entryDeadline,
      maxEntries = 8,
      entryFeeNanoerg,
      entryFeeToken,
      seasonId,
      collectionId,
      autoResolve,
      rarityClass,
    } = req.body ?? {};

    if (!name || !raceType || !entryDeadline) {
      return res.status(400).json({ error: 'name, raceType, and entryDeadline are required' });
    }

    // Validate rarity class if provided (class names are universal; tier lists are per-collection)
    const VALID_CLASSES = ['rookie', 'contender', 'champion'];
    if (rarityClass && !VALID_CLASSES.includes(rarityClass)) {
      return res.status(400).json({ error: `Invalid rarity class: ${rarityClass}. Valid: rookie, contender, champion` });
    }

    // Get active season — use collectionId to find the right season when provided
    let activeSeasonId = seasonId;
    let activeCollectionId = collectionId;
    let entryFee = entryFeeNanoerg;

    if (!activeSeasonId) {
      // Pass collectionId to find the right season (required for multi-collection)
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

      // Use collection's default entry fee if not specified
      if (entryFee === undefined && season.collection_id) {
        const { data: collection } = await supabase
          .from('collections')
          .select('entry_fee_nanoerg')
          .eq('id', season.collection_id)
          .single();
        const defaultFeeNanoerg = collection?.entry_fee_nanoerg ?? 0;

        // Auto-calculate proportional ERG when admin sets a custom token fee
        // but doesn't explicitly set the ERG fee.
        // Rate derived from: default_race_entry_fee CYPX = defaultFeeNanoerg ERG
        if (entryFeeToken && defaultFeeNanoerg > 0) {
          const config = await getGameConfig(season.collection_id);
          const feeTokenConfig = config?.fee_token;
          const defaultTokenFee = feeTokenConfig?.default_race_entry_fee;
          if (defaultTokenFee && defaultTokenFee > 0) {
            entryFee = Math.round(entryFeeToken * (defaultFeeNanoerg / defaultTokenFee));
          } else {
            entryFee = defaultFeeNanoerg;
          }
        } else {
          entryFee = defaultFeeNanoerg;
        }
      }
    }

    const { data: race, error } = await supabase
      .from('season_races')
      .insert({
        name,
        race_type: raceType,
        entry_fee_nanoerg: entryFee ?? 0,
        max_entries: maxEntries,
        entry_deadline: entryDeadline,
        status: 'open',
        auto_resolve: autoResolve ?? true,
        season_id: activeSeasonId,
        collection_id: activeCollectionId,
        entry_fee_token: entryFeeToken ?? null,
        rarity_class: rarityClass || null,
        class_weight: rarityClass ? DEFAULT_CLASS_WEIGHT : 1.0,
      })
      .select('*')
      .single();

    if (error || !race) {
      return res.status(500).json({ error: 'Failed to create race' });
    }

    return res.status(200).json({
      success: true,
      race: {
        id: race.id,
        name: race.name,
        raceType: race.race_type,
        entryFee: nanoErgToErg(race.entry_fee_nanoerg ?? 0),
        entryFeeToken: race.entry_fee_token ?? null,
        maxEntries: race.max_entries,
        entryDeadline: race.entry_deadline,
        status: race.status,
        autoResolve: race.auto_resolve ?? true,
        rarityClass: race.rarity_class ?? null,
        classWeight: race.class_weight ?? 1.0,
      },
    });
  } catch (err) {
    console.error('POST /api/v2/admin/races/create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

#!/usr/bin/env ts-node
/**
 * Bulk CyberPets Registration Script
 *
 * Reads the CyberPets collection row from Supabase (base_stat_template +
 * trait_mapping), loads all 460 circulating CyberPets from the local
 * cyber_pet_traits.json, computes base_stats for each, and inserts rows
 * into creatures, creature_stats, and prestige.
 *
 * Usage: npx ts-node scripts/register-cyberpets.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenEntry {
  token_id: string;
  name: string;
  description: string;
  number: number;
  current_holder: string;
  status: string;
}

interface TraitData {
  CyberPet?: string;
  Rarity?: string;
  Pet?: string;
  'Skin Color'?: string;
  Background?: string;
  Stage?: string;
  [key: string]: string | undefined;
}

type StatName = 'speed' | 'stamina' | 'accel' | 'agility' | 'heart' | 'focus';
type Stats = Record<StatName, number>;

const STAT_KEYS: StatName[] = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'];

// Material quality mapping for body parts
const MATERIAL_QUALITY: Record<string, number> = {
  cyberium: 4,
  diamond: 3,
  golden: 2,
  silver: 1,
};

// ---------------------------------------------------------------------------
// Trait parsing
// ---------------------------------------------------------------------------

function parseTraits(description: string): TraitData & { bodyParts: string[] } {
  const parsed = JSON.parse(description);
  let traits: Record<string, string>;

  if (parsed['721']) {
    const keys = Object.keys(parsed['721']);
    if (keys.length > 0) {
      traits = parsed['721'][keys[0]].traits || parsed['721'][keys[0]];
    } else {
      traits = parsed;
    }
  } else {
    traits = parsed;
  }

  const bodyParts: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const part = traits[`Body part ${i}`];
    if (part) bodyParts.push(part);
  }

  return { ...traits, bodyParts } as TraitData & { bodyParts: string[] };
}

/**
 * Determine the best material quality from body parts.
 * Returns a numeric quality score (higher = better).
 */
function getMaterialQuality(bodyParts: string[]): number {
  let best = 0;
  for (const part of bodyParts) {
    const lower = part.toLowerCase();
    for (const [material, quality] of Object.entries(MATERIAL_QUALITY)) {
      if (lower.includes(material) && quality > best) {
        best = quality;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Base stat computation
// ---------------------------------------------------------------------------

function computeBaseStats(
  rarity: string,
  bodyPartCount: number,
  materialQuality: number,
  baseStatTemplate: Record<string, any>,
  traitMapping: Record<string, any>,
): Stats {
  // Get rarity tier data from template
  const tier = baseStatTemplate[rarity] || baseStatTemplate['Common'] || {};
  const totalBase: number = tier.total_base ?? 60;
  const bias: Partial<Stats> = tier.bias ?? {};

  // Start with bias values (or distribute evenly)
  const stats: Stats = { speed: 0, stamina: 0, accel: 0, agility: 0, heart: 0, focus: 0 };
  let allocated = 0;

  for (const key of STAT_KEYS) {
    stats[key] = bias[key] ?? 0;
    allocated += stats[key];
  }

  // If bias didn't fill the budget, distribute remaining evenly
  if (allocated < totalBase) {
    const remaining = totalBase - allocated;
    const perStat = remaining / STAT_KEYS.length;
    for (const key of STAT_KEYS) {
      stats[key] += perStat;
    }
  }

  // Apply trait_mapping: body_part_count → +stamina per part
  const staminaPerPart: number = traitMapping?.body_part_count?.stamina_per_part ?? 0.5;
  stats.stamina += bodyPartCount * staminaPerPart;

  // Apply trait_mapping: material_quality → +focus
  const focusPerQuality: number = traitMapping?.material_quality?.focus_per_level ?? 0.5;
  stats.focus += materialQuality * focusPerQuality;

  // Cap individual stats so total doesn't exceed tier's total_base
  let currentTotal = STAT_KEYS.reduce((s, k) => s + stats[k], 0);
  if (currentTotal > totalBase) {
    const scale = totalBase / currentTotal;
    for (const key of STAT_KEYS) {
      stats[key] = stats[key] * scale;
    }
  }

  // Cap each stat at 80 and round
  for (const key of STAT_KEYS) {
    stats[key] = Math.round(Math.min(80, Math.max(0, stats[key])) * 100) / 100;
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== CyberPets Bulk Registration ===\n');

  // 1. Fetch collection row
  const { data: collection, error: collErr } = await supabase
    .from('collections')
    .select('*')
    .eq('name', 'CyberPets')
    .single();

  if (collErr || !collection) {
    console.error('Failed to fetch CyberPets collection:', collErr?.message);
    process.exit(1);
  }

  const baseStatTemplate = collection.base_stat_template || {};
  const traitMapping = collection.trait_mapping || {};
  const collectionId = collection.id;

  console.log(`Collection ID: ${collectionId}`);
  console.log(`Base stat template tiers: ${Object.keys(baseStatTemplate).join(', ')}`);

  // 2. Fetch active season
  const { data: activeSeason, error: seasonErr } = await supabase
    .from('seasons')
    .select('id, name, status')
    .eq('status', 'active')
    .single();

  if (seasonErr || !activeSeason) {
    console.error('No active season found:', seasonErr?.message);
    process.exit(1);
  }

  console.log(`Active season: ${activeSeason.name} (${activeSeason.id})\n`);

  // 3. Load CyberPets from local JSON
  const traitsPath = path.resolve(__dirname, '../data/ergo/cyberpets/cyber_pet_traits.json');
  const rawData = fs.readFileSync(traitsPath, 'utf-8');
  const petData = JSON.parse(rawData);
  const tokens: TokenEntry[] = petData.tokens.filter(
    (t: TokenEntry) => t.status === 'circulating',
  );

  console.log(`Found ${tokens.length} circulating CyberPets\n`);

  // 4. Fetch already-registered creature token_ids to avoid duplicates
  const { data: existing } = await supabase
    .from('creatures')
    .select('token_id')
    .eq('collection_id', collectionId);

  const existingIds = new Set((existing || []).map((c: any) => c.token_id));

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const token of tokens) {
    if (existingIds.has(token.token_id)) {
      skipped++;
      continue;
    }

    try {
      const traits = parseTraits(token.description);
      const rarity = traits.Rarity || 'Common';
      const bodyPartCount = traits.bodyParts.length;
      const materialQuality = getMaterialQuality(traits.bodyParts);

      const baseStats = computeBaseStats(
        rarity,
        bodyPartCount,
        materialQuality,
        baseStatTemplate,
        traitMapping,
      );

      // Insert creature
      const { data: creatureRow, error: creatureErr } = await supabase
        .from('creatures')
        .insert({
          token_id: token.token_id,
          collection_id: collectionId,
          name: token.name,
          owner_address: token.current_holder,
          rarity,
          base_stats: baseStats,
          metadata: {
            pet: traits.Pet,
            skinColor: traits['Skin Color'],
            background: traits.Background,
            stage: traits.Stage,
            bodyParts: traits.bodyParts,
            bodyPartCount,
            materialQuality,
            number: token.number,
          },
        })
        .select('id')
        .single();

      if (creatureErr) {
        console.error(`  Error inserting creature ${token.name}: ${creatureErr.message}`);
        errors++;
        continue;
      }

      const creatureId = creatureRow.id;

      // Insert creature_stats for active season
      const { error: statsErr } = await supabase.from('creature_stats').insert({
        creature_id: creatureId,
        season_id: activeSeason.id,
        speed: 0,
        stamina: 0,
        accel: 0,
        agility: 0,
        heart: 0,
        focus: 0,
        fatigue: 0,
        sharpness: 50,
        action_count: 0,
      });

      if (statsErr) {
        console.error(`  Error inserting stats for ${token.name}: ${statsErr.message}`);
        errors++;
        continue;
      }

      // Insert prestige row
      const { error: prestigeErr } = await supabase.from('prestige').insert({
        creature_id: creatureId,
        total_races: 0,
        total_wins: 0,
        total_podiums: 0,
        total_earnings: 0,
        seasons_completed: 0,
      });

      if (prestigeErr) {
        console.error(`  Error inserting prestige for ${token.name}: ${prestigeErr.message}`);
        errors++;
        continue;
      }

      inserted++;
      if (inserted % 50 === 0) {
        console.log(`  Registered ${inserted} creatures...`);
      }
    } catch (err: any) {
      console.error(`  Error processing ${token.name}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n=== Registration Complete ===');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (already registered): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${tokens.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

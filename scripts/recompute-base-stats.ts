#!/usr/bin/env ts-node
/**
 * Recompute base_stats for ALL existing creatures using the corrected
 * base_stat_template from the collections table.
 *
 * Run AFTER fix-base-stat-template.ts has populated the template.
 *
 * Usage: npx ts-node scripts/recompute-base-stats.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Base stat computation (identical to api/_lib/cyberpets.ts)
// ---------------------------------------------------------------------------

type StatName = 'speed' | 'stamina' | 'accel' | 'agility' | 'heart' | 'focus';
type Stats = Record<StatName, number>;
const STAT_KEYS: StatName[] = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'];

function computeBaseStats(
  rarity: string,
  bodyPartCount: number,
  materialQuality: number,
  baseStatTemplate: Record<string, any>,
  traitMapping: Record<string, any>,
): Stats {
  const tier = baseStatTemplate[rarity] || baseStatTemplate['Common'] || {};
  const totalBase: number = tier.total_base ?? 60;
  const bias: Partial<Stats> = tier.bias ?? {};

  const stats: Stats = { speed: 0, stamina: 0, accel: 0, agility: 0, heart: 0, focus: 0 };
  let allocated = 0;

  for (const key of STAT_KEYS) {
    stats[key] = bias[key] ?? 0;
    allocated += stats[key];
  }

  if (allocated < totalBase) {
    const remaining = totalBase - allocated;
    const perStat = remaining / STAT_KEYS.length;
    for (const key of STAT_KEYS) {
      stats[key] += perStat;
    }
  }

  const staminaPerPart: number = traitMapping?.body_part_count?.stamina_per_part ?? 0.5;
  stats.stamina += bodyPartCount * staminaPerPart;

  const focusPerQuality: number = traitMapping?.material_quality?.focus_per_level ?? 0.5;
  stats.focus += materialQuality * focusPerQuality;

  let currentTotal = STAT_KEYS.reduce((s, k) => s + stats[k], 0);
  if (currentTotal > totalBase) {
    const scale = totalBase / currentTotal;
    for (const key of STAT_KEYS) {
      stats[key] = stats[key] * scale;
    }
  }

  for (const key of STAT_KEYS) {
    stats[key] = Math.round(Math.min(80, Math.max(0, stats[key])) * 100) / 100;
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Recompute Base Stats for All Creatures ===\n');

  // 1. Fetch collection config
  const { data: collection, error: collErr } = await supabase
    .from('collections')
    .select('id, base_stat_template, trait_mapping')
    .eq('name', 'CyberPets')
    .single();

  if (collErr || !collection) {
    console.error('Failed to fetch CyberPets collection:', collErr?.message);
    process.exit(1);
  }

  const baseStatTemplate = collection.base_stat_template || {};
  const traitMapping = collection.trait_mapping || {};

  // Verify template is populated
  const tiers = Object.keys(baseStatTemplate);
  if (tiers.length === 0) {
    console.error('base_stat_template is empty! Run fix-base-stat-template.ts first.');
    process.exit(1);
  }
  console.log(`Template tiers: ${tiers.join(', ')}`);

  // 2. Fetch all creatures
  const { data: creatures, error: creaturesErr } = await supabase
    .from('creatures')
    .select('id, rarity, metadata, base_stats')
    .eq('collection_id', collection.id);

  if (creaturesErr || !creatures) {
    console.error('Failed to fetch creatures:', creaturesErr?.message);
    process.exit(1);
  }

  console.log(`Found ${creatures.length} creatures to recompute\n`);

  let updated = 0;
  let errors = 0;
  const rarityTotals: Record<string, { count: number; sumBefore: number; sumAfter: number }> = {};

  for (const creature of creatures) {
    const rarity = creature.rarity || 'Common';
    const bodyPartCount = creature.metadata?.bodyPartCount ?? 0;
    const materialQuality = creature.metadata?.materialQuality ?? 0;

    const oldStats = creature.base_stats || {};
    const oldTotal = STAT_KEYS.reduce((s, k) => s + (oldStats[k] ?? 0), 0);

    const newStats = computeBaseStats(
      rarity,
      bodyPartCount,
      materialQuality,
      baseStatTemplate,
      traitMapping,
    );
    const newTotal = STAT_KEYS.reduce((s, k) => s + newStats[k], 0);

    // Track per-rarity stats
    if (!rarityTotals[rarity]) {
      rarityTotals[rarity] = { count: 0, sumBefore: 0, sumAfter: 0 };
    }
    rarityTotals[rarity].count++;
    rarityTotals[rarity].sumBefore += oldTotal;
    rarityTotals[rarity].sumAfter += newTotal;

    // Update creature
    const { error: updateErr } = await supabase
      .from('creatures')
      .update({ base_stats: newStats })
      .eq('id', creature.id);

    if (updateErr) {
      console.error(`  Error updating creature ${creature.id}: ${updateErr.message}`);
      errors++;
    } else {
      updated++;
    }
  }

  console.log('=== Results ===\n');
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}\n`);

  console.log('Per-rarity averages (before → after):');
  for (const [rarity, data] of Object.entries(rarityTotals).sort((a, b) => a[1].sumAfter / a[1].count - b[1].sumAfter / b[1].count)) {
    const avgBefore = (data.sumBefore / data.count).toFixed(1);
    const avgAfter = (data.sumAfter / data.count).toFixed(1);
    console.log(`  ${rarity.padEnd(12)} (${String(data.count).padStart(3)} creatures): ${avgBefore} → ${avgAfter}`);
  }

  console.log('\nDone! You can now end the current season and start a new one.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

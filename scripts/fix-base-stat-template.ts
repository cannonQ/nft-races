#!/usr/bin/env ts-node
/**
 * Fix: Populate collections.base_stat_template with proper rarity tiers.
 *
 * The base_stat_template was never seeded, causing ALL creatures to fall back
 * to 60 base points regardless of rarity. This script sets the correct values.
 *
 * Usage: npx ts-node scripts/fix-base-stat-template.ts
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

const BASE_STAT_TEMPLATE: Record<string, { total_base: number; bias: Record<string, number> }> = {
  Common:     { total_base: 60,  bias: {} },
  Uncommon:   { total_base: 70,  bias: {} },
  Rare:       { total_base: 80,  bias: {} },
  Masterwork: { total_base: 85,  bias: {} },
  Epic:       { total_base: 90,  bias: {} },
  Relic:      { total_base: 95,  bias: {} },
  Legendary:  { total_base: 100, bias: {} },
  Mythic:     { total_base: 110, bias: {} },
  Cyberium:   { total_base: 120, bias: {} },
};

const TRAIT_MAPPING = {
  body_part_count: { stamina_per_part: 0.5 },
  material_quality: { focus_per_level: 0.5 },
};

async function main() {
  console.log('=== Fix: Populate base_stat_template ===\n');

  // Fetch current collection row
  const { data: collection, error: fetchErr } = await supabase
    .from('collections')
    .select('id, name, base_stat_template, trait_mapping')
    .eq('name', 'CyberPets')
    .single();

  if (fetchErr || !collection) {
    console.error('Failed to fetch CyberPets collection:', fetchErr?.message);
    process.exit(1);
  }

  console.log(`Collection ID: ${collection.id}`);
  console.log(`Current base_stat_template: ${JSON.stringify(collection.base_stat_template)}`);
  console.log(`Current trait_mapping: ${JSON.stringify(collection.trait_mapping)}\n`);

  // Update with correct values
  const { error: updateErr } = await supabase
    .from('collections')
    .update({
      base_stat_template: BASE_STAT_TEMPLATE,
      trait_mapping: TRAIT_MAPPING,
    })
    .eq('id', collection.id);

  if (updateErr) {
    console.error('Failed to update collection:', updateErr.message);
    process.exit(1);
  }

  console.log('Updated base_stat_template:');
  for (const [rarity, tier] of Object.entries(BASE_STAT_TEMPLATE)) {
    console.log(`  ${rarity.padEnd(12)} → ${tier.total_base} total base points`);
  }
  console.log('\nUpdated trait_mapping:');
  console.log(`  body_part_count.stamina_per_part = ${TRAIT_MAPPING.body_part_count.stamina_per_part}`);
  console.log(`  material_quality.focus_per_level = ${TRAIT_MAPPING.material_quality.focus_per_level}`);
  console.log('\nDone! Now run: npx ts-node scripts/recompute-base-stats.ts');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

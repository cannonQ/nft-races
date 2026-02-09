#!/usr/bin/env ts-node
/**
 * Resolve Races CLI Script
 *
 * Finds open races past their entry deadline and resolves them via the admin API.
 * Can also resolve a specific race by ID.
 *
 * Usage:
 *   npx ts-node scripts/resolve-races.ts              # resolve all past-deadline races
 *   npx ts-node scripts/resolve-races.ts --id <uuid>  # resolve a specific race
 *   npx ts-node scripts/resolve-races.ts --base http://localhost:3000
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';

const CRON_SECRET = process.env.CRON_SECRET || 'cyberpets-admin-2026-xK9mP3';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : undefined;
}

async function resolveRace(raceId: string): Promise<void> {
  console.log(`  Resolving race ${raceId}...`);

  const res = await fetch(`${BASE}/api/v2/admin/races/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ raceId }),
  });

  const data = await res.json();
  console.log(`  Status: ${res.status}`);

  if (data.cancelled) {
    console.log(`  Cancelled: ${data.reason}`);
  } else if (data.results) {
    console.log(`  Block hash: ${data.blockHash}`);
    console.log(`  Results:`);
    for (const r of data.results) {
      console.log(`    ${r.position}. Creature ${r.creatureId} — score: ${r.performanceScore}, payout: ${r.payout} ERG`);
    }
  } else {
    console.log(`  Response: ${JSON.stringify(data, null, 2)}`);
  }
  console.log('');
}

async function main() {
  const specificId = getArg('--id');

  if (specificId) {
    console.log(`Resolving specific race: ${specificId}\n`);
    await resolveRace(specificId);
    return;
  }

  // Find all open races past their deadline
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.');
    console.error('Set them in .env.local or use --id <raceId> to resolve a specific race.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const now = new Date().toISOString();
  const { data: races, error } = await supabase
    .from('season_races')
    .select('id, name, race_type, entry_deadline, status')
    .eq('status', 'open')
    .lt('entry_deadline', now);

  if (error) {
    console.error('Failed to query races:', error.message);
    process.exit(1);
  }

  if (!races || races.length === 0) {
    console.log('No open races past their deadline. Nothing to resolve.');
    return;
  }

  console.log(`Found ${races.length} race(s) to resolve:\n`);
  for (const race of races) {
    console.log(`  ${race.name} (${race.race_type}) — deadline: ${race.entry_deadline}`);
  }
  console.log('');

  for (const race of races) {
    await resolveRace(race.id);
  }

  console.log('Done.');
}

main().catch(console.error);

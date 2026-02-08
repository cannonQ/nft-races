#!/usr/bin/env ts-node
/**
 * Create Race CLI Script
 *
 * Creates a new race via the admin API endpoint.
 *
 * Usage:
 *   npx ts-node scripts/create-race.ts
 *   npx ts-node scripts/create-race.ts --name "Sprint Showdown" --type sprint --deadline 60 --max 8
 *
 * Options:
 *   --name      Race name (default: "Test <type> Race")
 *   --type      Race type: sprint | distance | technical | mixed | hazard (default: sprint)
 *   --deadline  Minutes until entry deadline (default: 60)
 *   --max       Max entries (default: 8)
 *   --base      Base URL (default: http://localhost:3000)
 */

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:3000';

const CRON_SECRET = process.env.CRON_SECRET || 'cyberpets-admin-2026-xK9mP3';

function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const raceType = getArg('--type', 'sprint');
const name = getArg('--name', `Test ${raceType} Race`);
const deadlineMinutes = parseInt(getArg('--deadline', '60'), 10);
const maxEntries = parseInt(getArg('--max', '8'), 10);

const entryDeadline = new Date(Date.now() + deadlineMinutes * 60 * 1000).toISOString();

async function main() {
  console.log(`Creating race...`);
  console.log(`  Name:     ${name}`);
  console.log(`  Type:     ${raceType}`);
  console.log(`  Deadline: ${entryDeadline} (${deadlineMinutes} min from now)`);
  console.log(`  Max:      ${maxEntries}`);
  console.log(`  URL:      ${BASE}/api/v2/admin/races/create\n`);

  const res = await fetch(`${BASE}/api/v2/admin/races/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({
      name,
      raceType,
      entryDeadline,
      maxEntries,
    }),
  });

  const data = await res.json();
  console.log(`Status: ${res.status}`);
  console.log(JSON.stringify(data, null, 2));

  if (data.race?.id) {
    console.log(`\nRace ID: ${data.race.id}`);
    console.log(`Enter with: POST ${BASE}/api/v2/races/${data.race.id}/enter`);
  }
}

main().catch(console.error);

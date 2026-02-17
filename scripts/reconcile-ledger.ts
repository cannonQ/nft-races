#!/usr/bin/env npx ts-node
/**
 * B1-1: Reconciliation script for credit_ledger.
 *
 * Cross-references training_log and season_race_entries with credit_ledger
 * to find missing ledger entries (fire-and-forget failures).
 *
 * Usage:
 *   npx ts-node scripts/reconcile-ledger.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface MissingEntry {
  source: string;
  sourceId: string;
  creatureId: string;
  ownerAddress: string;
  seasonId: string;
  expectedTxType: string;
  createdAt: string;
}

async function findMissingTrainingEntries(): Promise<MissingEntry[]> {
  const missing: MissingEntry[] = [];

  // Fetch all training logs
  const { data: logs, error } = await supabase
    .from('training_log')
    .select('id, creature_id, owner_address, season_id, created_at')
    .order('created_at', { ascending: false });

  if (error || !logs) {
    console.error('Failed to fetch training_log:', error);
    return missing;
  }

  console.log(`Checking ${logs.length} training log entries...`);

  // Check each log entry for a corresponding ledger entry
  for (const log of logs) {
    const { count } = await supabase
      .from('credit_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('training_log_id', log.id);

    if ((count ?? 0) === 0) {
      missing.push({
        source: 'training_log',
        sourceId: log.id,
        creatureId: log.creature_id,
        ownerAddress: log.owner_address,
        seasonId: log.season_id,
        expectedTxType: 'training_fee',
        createdAt: log.created_at,
      });
    }
  }

  return missing;
}

async function findMissingRaceEntries(): Promise<MissingEntry[]> {
  const missing: MissingEntry[] = [];

  // Fetch all race entries
  const { data: entries, error } = await supabase
    .from('season_race_entries')
    .select('id, creature_id, owner_address, race_id, created_at, season_race_entries_race_id_fkey:season_races!inner(season_id, entry_fee_nanoerg)')
    .order('created_at', { ascending: false });

  if (error || !entries) {
    // Fallback: try without the join
    const { data: entriesSimple, error: err2 } = await supabase
      .from('season_race_entries')
      .select('id, creature_id, owner_address, race_id, created_at')
      .order('created_at', { ascending: false });

    if (err2 || !entriesSimple) {
      console.error('Failed to fetch season_race_entries:', err2);
      return missing;
    }

    console.log(`Checking ${entriesSimple.length} race entry records (simple mode)...`);

    for (const entry of entriesSimple) {
      const { count } = await supabase
        .from('credit_ledger')
        .select('*', { count: 'exact', head: true })
        .eq('race_entry_id', entry.id);

      if ((count ?? 0) === 0) {
        missing.push({
          source: 'season_race_entries',
          sourceId: entry.id,
          creatureId: entry.creature_id,
          ownerAddress: entry.owner_address,
          seasonId: '',
          expectedTxType: 'race_entry_fee',
          createdAt: entry.created_at,
        });
      }
    }

    return missing;
  }

  console.log(`Checking ${entries.length} race entry records...`);

  for (const entry of entries as any[]) {
    const race = entry.season_race_entries_race_id_fkey || {};
    const entryFee = race.entry_fee_nanoerg ?? 0;

    // Skip entries with no fee (free races don't need ledger entries)
    if (entryFee <= 0) continue;

    const { count } = await supabase
      .from('credit_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('race_entry_id', entry.id);

    if ((count ?? 0) === 0) {
      missing.push({
        source: 'season_race_entries',
        sourceId: entry.id,
        creatureId: entry.creature_id,
        ownerAddress: entry.owner_address,
        seasonId: race.season_id ?? '',
        expectedTxType: 'race_entry_fee',
        createdAt: entry.created_at,
      });
    }
  }

  return missing;
}

async function findMissingTreatmentEntries(): Promise<MissingEntry[]> {
  const missing: MissingEntry[] = [];

  const { data: logs, error } = await supabase
    .from('treatment_log')
    .select('id, creature_id, owner_address, season_id, created_at, cost_nanoerg')
    .order('created_at', { ascending: false });

  if (error || !logs) {
    console.error('Failed to fetch treatment_log:', error);
    return missing;
  }

  console.log(`Checking ${logs.length} treatment log entries...`);

  for (const log of logs) {
    // Skip free treatments
    if ((log.cost_nanoerg ?? 0) <= 0) continue;

    // Treatment log doesn't have a direct FK in credit_ledger,
    // so match by creature_id + tx_type + approximate time
    const { count } = await supabase
      .from('credit_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('creature_id', log.creature_id)
      .eq('tx_type', 'treatment_fee')
      .gte('created_at', new Date(new Date(log.created_at).getTime() - 5000).toISOString())
      .lte('created_at', new Date(new Date(log.created_at).getTime() + 5000).toISOString());

    if ((count ?? 0) === 0) {
      missing.push({
        source: 'treatment_log',
        sourceId: log.id,
        creatureId: log.creature_id,
        ownerAddress: log.owner_address,
        seasonId: log.season_id,
        expectedTxType: 'treatment_fee',
        createdAt: log.created_at,
      });
    }
  }

  return missing;
}

async function checkBalanceConsistency(): Promise<void> {
  console.log('\n--- Balance Consistency Check ---');

  // Get all unique wallet addresses
  const { data: wallets, error } = await supabase
    .from('credit_ledger')
    .select('owner_address')
    .limit(1000);

  if (error || !wallets) {
    console.error('Failed to fetch wallets:', error);
    return;
  }

  const uniqueAddresses = [...new Set(wallets.map(w => w.owner_address))];
  let driftCount = 0;

  for (const addr of uniqueAddresses) {
    // Get SUM-based balance (authoritative)
    const { data: rows } = await supabase
      .from('credit_ledger')
      .select('amount_nanoerg')
      .eq('owner_address', addr);

    const sumBalance = (rows ?? []).reduce((sum: number, r: any) => sum + (r.amount_nanoerg ?? 0), 0);

    // Get last-row balance (potentially stale)
    const { data: latest } = await supabase
      .from('credit_ledger')
      .select('balance_after_nanoerg')
      .eq('owner_address', addr)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastRowBalance = latest?.balance_after_nanoerg ?? 0;

    if (Math.abs(sumBalance - lastRowBalance) > 1) {
      console.log(`  DRIFT: ${addr.slice(0, 12)}... SUM=${sumBalance} vs last_row=${lastRowBalance} (diff=${sumBalance - lastRowBalance})`);
      driftCount++;
    }
  }

  console.log(`Checked ${uniqueAddresses.length} wallets, found ${driftCount} with balance drift.`);
}

async function main() {
  console.log('=== CyberPets Racing Ledger Reconciliation ===\n');

  const [trainingMissing, raceMissing, treatmentMissing] = await Promise.all([
    findMissingTrainingEntries(),
    findMissingRaceEntries(),
    findMissingTreatmentEntries(),
  ]);

  console.log('\n--- Results ---');
  console.log(`Missing training_fee entries: ${trainingMissing.length}`);
  console.log(`Missing race_entry_fee entries: ${raceMissing.length}`);
  console.log(`Missing treatment_fee entries: ${treatmentMissing.length}`);

  const allMissing = [...trainingMissing, ...raceMissing, ...treatmentMissing];

  if (allMissing.length > 0) {
    console.log('\nMissing entries:');
    for (const m of allMissing) {
      console.log(`  [${m.expectedTxType}] ${m.source}:${m.sourceId} creature=${m.creatureId} owner=${m.ownerAddress.slice(0, 12)}... at=${m.createdAt}`);
    }
  } else {
    console.log('\nAll ledger entries accounted for!');
  }

  await checkBalanceConsistency();
}

main().catch(err => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});

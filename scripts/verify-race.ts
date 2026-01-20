#!/usr/bin/env node
/**
 * CyberPets Race Verification Script
 * 
 * Anyone can run this to verify a race result was fair.
 * 
 * Usage:
 *   npx ts-node verify-race.ts <race-id>
 *   node verify-race.js <race-id>
 */

import seedrandom from 'seedrandom';
import { createHash } from 'crypto';

// ============================================
// CONFIG
// ============================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

const RARITY_MULTIPLIER: Record<string, number> = {
  'Common': 1.00,
  'Uncommon': 1.01,
  'Rare': 1.02,
  'Epic': 1.04,
  'Legendary': 1.05,
  'Mythic': 1.06,
  'Relic': 1.07,
  'Masterwork': 1.08,
  'Cyberium': 1.10
};

const RACE_SEGMENTS = 10;
const PAYOUT_SPLIT = { 1: 0.50, 2: 0.30, 3: 0.15, house: 0.05 };

// ============================================
// TYPES
// ============================================
interface RaceEntry {
  nft_token_id: string;
  nft_name: string;
  owner_address: string;
  signature: string;
  speed_multiplier: number;
  consistency: number;
  traits: any;
}

interface Race {
  id: string;
  server_seed: string;
  server_seed_hash: string;
  combined_seed: string;
  entry_fee: number;
  results: any[];
}

// ============================================
// CORE FUNCTIONS
// ============================================

function combineSeed(serverSeed: string, signatures: string[]): string {
  const sortedSigs = [...signatures].sort();
  const combined = serverSeed + sortedSigs.join('');
  return createHash('sha256').update(combined).digest('hex');
}

function verifyServerSeed(serverSeed: string, publishedHash: string): boolean {
  const hash = createHash('sha256').update(serverSeed).digest('hex');
  return hash === publishedHash;
}

function simulateSegment(rng: () => number, speed: number, consistency: number): number {
  const baseRoll = rng() * 100;
  const variance = (1 - consistency) * 40;
  const swing = (rng() - 0.5) * variance;
  return (baseRoll + swing) * speed;
}

function simulateRace(combinedSeed: string, entries: RaceEntry[], entryFee: number) {
  const rng = seedrandom(combinedSeed);
  
  const distances = new Map<string, number>();
  entries.forEach(e => distances.set(e.nft_token_id, 0));
  
  for (let seg = 0; seg < RACE_SEGMENTS; seg++) {
    for (const entry of entries) {
      const dist = simulateSegment(rng, entry.speed_multiplier, entry.consistency);
      distances.set(entry.nft_token_id, (distances.get(entry.nft_token_id) || 0) + dist);
    }
  }
  
  const sorted = entries
    .map(e => ({
      nftTokenId: e.nft_token_id,
      nftName: e.nft_name,
      ownerAddress: e.owner_address,
      finalDistance: Math.round((distances.get(e.nft_token_id) || 0) * 100) / 100
    }))
    .sort((a, b) => b.finalDistance - a.finalDistance);
  
  const totalPot = entries.length * entryFee;
  const houseCut = Math.floor(totalPot * PAYOUT_SPLIT.house);
  const prizePot = totalPot - houseCut;
  
  return sorted.map((entry, index) => {
    const position = index + 1;
    let payoutAmount = 0;
    if (position === 1) payoutAmount = Math.floor(prizePot * PAYOUT_SPLIT[1]);
    else if (position === 2) payoutAmount = Math.floor(prizePot * PAYOUT_SPLIT[2]);
    else if (position === 3) payoutAmount = Math.floor(prizePot * PAYOUT_SPLIT[3]);
    
    return { ...entry, position, payoutAmount };
  });
}

// ============================================
// FETCH DATA
// ============================================

async function fetchRaceData(raceId: string): Promise<{ race: Race; entries: RaceEntry[] }> {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  };
  
  // Fetch race
  const raceRes = await fetch(
    `${SUPABASE_URL}/rest/v1/races?id=eq.${raceId}&select=*`,
    { headers }
  );
  const races = await raceRes.json();
  if (!races.length) throw new Error('Race not found');
  
  // Fetch entries
  const entriesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/race_entries?race_id=eq.${raceId}&disqualified=eq.false&select=*`,
    { headers }
  );
  const entries = await entriesRes.json();
  
  return { race: races[0], entries };
}

// ============================================
// MAIN
// ============================================

async function main() {
  const raceId = process.argv[2];
  
  if (!raceId) {
    console.log('Usage: npx ts-node verify-race.ts <race-id>');
    process.exit(1);
  }
  
  console.log(`\n🏁 Verifying Race: ${raceId}\n`);
  console.log('='.repeat(60));
  
  // Fetch data
  console.log('\n📥 Fetching race data...');
  const { race, entries } = await fetchRaceData(raceId);
  
  if (race.status !== 'resolved') {
    console.log(`❌ Race status is "${race.status}", not "resolved"`);
    process.exit(1);
  }
  
  // Step 1: Verify server seed
  console.log('\n🔐 Step 1: Verify server seed hash...');
  const seedValid = verifyServerSeed(race.server_seed, race.server_seed_hash);
  console.log(`   Server seed: ${race.server_seed.substring(0, 16)}...`);
  console.log(`   Published hash: ${race.server_seed_hash.substring(0, 16)}...`);
  console.log(`   Computed hash:  ${createHash('sha256').update(race.server_seed).digest('hex').substring(0, 16)}...`);
  console.log(`   ✅ Match: ${seedValid ? 'YES' : 'NO'}`);
  
  if (!seedValid) {
    console.log('\n❌ VERIFICATION FAILED: Server seed does not match hash');
    process.exit(1);
  }
  
  // Step 2: Verify combined seed
  console.log('\n🔗 Step 2: Verify combined seed...');
  const signatures = entries.map(e => e.signature);
  const computedCombined = combineSeed(race.server_seed, signatures);
  const combinedValid = computedCombined === race.combined_seed;
  console.log(`   Entry count: ${entries.length}`);
  console.log(`   Published combined: ${race.combined_seed.substring(0, 16)}...`);
  console.log(`   Computed combined:  ${computedCombined.substring(0, 16)}...`);
  console.log(`   ✅ Match: ${combinedValid ? 'YES' : 'NO'}`);
  
  if (!combinedValid) {
    console.log('\n❌ VERIFICATION FAILED: Combined seed mismatch');
    process.exit(1);
  }
  
  // Step 3: Re-run simulation
  console.log('\n🎲 Step 3: Re-run race simulation...');
  const computed = simulateRace(computedCombined, entries, race.entry_fee);
  
  // Step 4: Compare results
  console.log('\n📊 Step 4: Compare results...\n');
  console.log('   Pos | NFT Name                | Distance    | Payout');
  console.log('   ' + '-'.repeat(56));
  
  let allMatch = true;
  for (let i = 0; i < computed.length; i++) {
    const c = computed[i];
    const p = race.results[i];
    
    const match = c.nftTokenId === p.nftTokenId && 
                  c.position === p.position &&
                  c.finalDistance === p.finalDistance;
    
    if (!match) allMatch = false;
    
    const status = match ? '✅' : '❌';
    const payout = c.payoutAmount > 0 ? `${(c.payoutAmount / 1e9).toFixed(4)} ERG` : '-';
    console.log(`   ${status} ${c.position}  | ${c.nftName.padEnd(23)} | ${c.finalDistance.toFixed(2).padStart(10)} | ${payout}`);
  }
  
  // Final verdict
  console.log('\n' + '='.repeat(60));
  if (allMatch) {
    console.log('\n✅ VERIFICATION PASSED');
    console.log('   This race result is provably fair and has not been tampered with.\n');
  } else {
    console.log('\n❌ VERIFICATION FAILED');
    console.log('   The published results do not match the computed results.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

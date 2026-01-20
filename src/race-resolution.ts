/**
 * Race Resolution Service
 * Handles closing races, calculating results, and recording payouts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { combineSeed, simulateRace, RaceEntry } from './race-engine';
import { verifyNftOwnership } from './ergo-verify';
import { parseTraits, calculateStats } from './traits';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Use service key for backend operations
);

// Entry fee in nanoERG (0.05 ERG)
const ENTRY_FEE = 50_000_000;

// Minimum entries to run a race
const MIN_ENTRIES = 2;

interface Race {
  id: string;
  entry_deadline: string;
  server_seed_hash: string;
  server_seed: string;
  status: string;
  min_entries: number;
  entry_fee: number;
}

interface DbEntry {
  id: string;
  race_id: string;
  nft_token_id: string;
  nft_name: string;
  owner_address: string;
  signature: string;
  traits: any;
  speed_multiplier: number;
  consistency: number;
  is_house_nft: boolean;
}

/**
 * Resolve a single race
 */
export async function resolveRace(raceId: string): Promise<{ success: boolean; error?: string }> {
  console.log(`Resolving race ${raceId}...`);
  
  // 1. Fetch race
  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('*')
    .eq('id', raceId)
    .single();
  
  if (raceError || !race) {
    return { success: false, error: `Race not found: ${raceError?.message}` };
  }
  
  if (race.status !== 'open' && race.status !== 'closed') {
    return { success: false, error: `Race already resolved or cancelled` };
  }
  
  // 2. Fetch entries
  const { data: entries, error: entriesError } = await supabase
    .from('race_entries')
    .select('*')
    .eq('race_id', raceId)
    .eq('disqualified', false);
  
  if (entriesError) {
    return { success: false, error: `Failed to fetch entries: ${entriesError.message}` };
  }
  
  // 3. Check minimum entries
  if (!entries || entries.length < (race.min_entries || MIN_ENTRIES)) {
    // Cancel race - not enough entries
    await supabase
      .from('races')
      .update({ status: 'cancelled' })
      .eq('id', raceId);
    
    return { success: false, error: `Not enough entries (${entries?.length || 0}/${race.min_entries})` };
  }
  
  // 4. Verify ownership for all entries (optional re-check)
  const validEntries: DbEntry[] = [];
  for (const entry of entries) {
    const { owns } = await verifyNftOwnership(entry.nft_token_id, entry.owner_address);
    
    if (!owns && !entry.is_house_nft) {
      // Disqualify - NFT transferred after entry
      await supabase
        .from('race_entries')
        .update({ 
          disqualified: true, 
          disqualified_reason: 'NFT ownership changed before race resolution' 
        })
        .eq('id', entry.id);
    } else {
      validEntries.push(entry);
    }
  }
  
  // 5. Re-check minimum after disqualifications
  if (validEntries.length < (race.min_entries || MIN_ENTRIES)) {
    await supabase
      .from('races')
      .update({ status: 'cancelled' })
      .eq('id', raceId);
    
    return { success: false, error: `Not enough valid entries after ownership check` };
  }
  
  // 6. Build race entries for simulation
  const raceEntries: RaceEntry[] = validEntries.map(e => ({
    nftTokenId: e.nft_token_id,
    nftName: e.nft_name,
    ownerAddress: e.owner_address,
    signature: e.signature,
    speedMultiplier: e.speed_multiplier,
    consistency: e.consistency,
    isHouseNft: e.is_house_nft
  }));
  
  // 7. Combine seed and run simulation
  const signatures = raceEntries.map(e => e.signature);
  const combinedSeed = combineSeed(race.server_seed, signatures);
  const simulation = simulateRace(combinedSeed, raceEntries, race.entry_fee || ENTRY_FEE);
  
  // 8. Update race with results
  await supabase
    .from('races')
    .update({
      status: 'resolved',
      combined_seed: combinedSeed,
      resolution_time: new Date().toISOString(),
      results: simulation.results
    })
    .eq('id', raceId);
  
  // 9. Update entries with results
  for (const result of simulation.results) {
    await supabase
      .from('race_entries')
      .update({
        final_position: result.position,
        final_distance: result.finalDistance,
        payout_amount: result.payoutAmount
      })
      .eq('race_id', raceId)
      .eq('nft_token_id', result.nftTokenId);
  }
  
  // 10. Insert into race_results for leaderboards
  const resultInserts = simulation.results.map(r => ({
    race_id: raceId,
    nft_token_id: r.nftTokenId,
    nft_name: r.nftName,
    owner_address: r.ownerAddress,
    position: r.position,
    distance: r.finalDistance,
    payout_amount: r.payoutAmount,
    traits: validEntries.find(e => e.nft_token_id === r.nftTokenId)?.traits
  }));
  
  await supabase.from('race_results').insert(resultInserts);
  
  // 11. Create payout records for winners
  const payoutInserts = simulation.results
    .filter(r => r.payoutAmount > 0)
    .map(r => ({
      race_id: raceId,
      recipient_address: r.ownerAddress,
      amount: r.payoutAmount,
      position: r.position,
      status: 'pending'
    }));
  
  if (payoutInserts.length > 0) {
    await supabase.from('payouts').insert(payoutInserts);
  }
  
  console.log(`Race ${raceId} resolved. Winner: ${simulation.results[0].nftName}`);
  
  return { success: true };
}

/**
 * Resolve all races past their deadline
 */
export async function resolveAllPendingRaces(): Promise<void> {
  const now = new Date().toISOString();
  
  // Find races past deadline that are still open
  const { data: races, error } = await supabase
    .from('races')
    .select('id')
    .eq('status', 'open')
    .lt('entry_deadline', now);
  
  if (error) {
    console.error('Failed to fetch pending races:', error);
    return;
  }
  
  console.log(`Found ${races?.length || 0} races to resolve`);
  
  for (const race of races || []) {
    await resolveRace(race.id);
  }
}

/**
 * Fill race with house NFTs if below minimum
 */
export async function fillRaceWithHouseNfts(
  raceId: string,
  targetCount: number = 4
): Promise<void> {
  // Get current entry count
  const { count } = await supabase
    .from('race_entries')
    .select('*', { count: 'exact', head: true })
    .eq('race_id', raceId)
    .eq('disqualified', false);
  
  const currentCount = count || 0;
  const needed = targetCount - currentCount;
  
  if (needed <= 0) return;
  
  // Get entered NFT IDs to exclude
  const { data: entered } = await supabase
    .from('race_entries')
    .select('nft_token_id')
    .eq('race_id', raceId);
  
  const enteredIds = new Set((entered || []).map(e => e.nft_token_id));
  
  // Fetch available house NFTs
  const { data: houseNfts } = await supabase
    .from('house_nfts')
    .select('*')
    .eq('active', true)
    .limit(needed * 2); // Fetch extra in case some are already entered
  
  if (!houseNfts || houseNfts.length === 0) {
    console.log('No house NFTs available');
    return;
  }
  
  // Filter out already entered and pick random
  const available = houseNfts.filter(h => !enteredIds.has(h.nft_token_id));
  const selected = available.slice(0, needed);
  
  // Create entries for house NFTs
  for (const house of selected) {
    const signature = `HOUSE-${raceId}-${house.nft_token_id}`; // House signature is deterministic
    
    await supabase.from('race_entries').insert({
      race_id: raceId,
      nft_token_id: house.nft_token_id,
      nft_name: house.nft_name,
      nft_number: house.nft_number,
      owner_address: house.owner_address,
      signature,
      traits: house.traits,
      speed_multiplier: house.speed_multiplier,
      consistency: house.consistency,
      is_house_nft: true
    });
    
    // Update house NFT stats
    await supabase
      .from('house_nfts')
      .update({ races_entered: house.races_entered + 1 })
      .eq('id', house.id);
  }
  
  console.log(`Added ${selected.length} house NFTs to race ${raceId}`);
}

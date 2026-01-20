import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import {
  getCyberPetCount,
  getCyberPetByIndex,
  HOUSE_WALLET_ADDRESS,
  RARITY_MULTIPLIERS,
} from '@/lib/cyberpets';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Payout percentages
const PAYOUTS = [
  { position: 1, percentage: 0.50 },
  { position: 2, percentage: 0.30 },
  { position: 3, percentage: 0.15 },
  // House keeps 5%
];

// Simple seeded RNG
function seededRandom(seed: string, index: number): number {
  const hash = createHash('sha256').update(seed + index.toString()).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0xffffffff;
}

/**
 * Fill race with house NFTs using provably fair selection from JSON data
 * Uses seeded random to select from 4000+ CyberPets
 */
async function fillWithHouseNfts(
  raceId: string,
  serverSeed: string,
  currentEntryCount: number,
  maxEntries: number
): Promise<{ filled: number; houseNfts: any[] }> {
  const needed = maxEntries - currentEntryCount;
  if (needed <= 0) return { filled: 0, houseNfts: [] };

  // Get NFTs already entered in this race
  const { data: existingEntries } = await supabase
    .from('race_entries')
    .select('nft_token_id')
    .eq('race_id', raceId);

  const enteredTokenIds = new Set((existingEntries || []).map(e => e.nft_token_id));

  // PROVABLY FAIR: Generate selection seed
  // Anyone can verify by: SHA256(server_seed + "HOUSE_FILL_" + raceId)
  const selectionSeed = createHash('sha256')
    .update(serverSeed + 'HOUSE_FILL_' + raceId)
    .digest('hex');

  const totalPets = getCyberPetCount();
  console.log(`Selecting ${needed} house NFTs from ${totalPets} CyberPets using seed: ${selectionSeed.slice(0, 16)}...`);

  // Select random CyberPets using seeded indices
  const insertedNfts = [];
  let attempts = 0;
  const maxAttempts = needed * 10; // Prevent infinite loop

  while (insertedNfts.length < needed && attempts < maxAttempts) {
    // Generate random index using seed + attempt number
    const randomValue = seededRandom(selectionSeed, attempts);
    const petIndex = Math.floor(randomValue * totalPets);

    const pet = getCyberPetByIndex(petIndex);
    attempts++;

    if (!pet) continue;

    // Skip if already entered
    if (enteredTokenIds.has(pet.tokenId)) continue;

    // Calculate racing stats
    const speedMultiplier = RARITY_MULTIPLIERS[pet.traits.rarity] || 1.0;
    const consistency = 0.5 + pet.traits.bodyParts.length * 0.04;

    // House signature is deterministic
    const signature = `HOUSE:${raceId}:${pet.tokenId}`;

    const { error: insertError } = await supabase.from('race_entries').insert({
      race_id: raceId,
      nft_token_id: pet.tokenId,
      nft_name: pet.name,
      nft_number: pet.number,
      owner_address: HOUSE_WALLET_ADDRESS,
      signature,
      traits: pet.traits,
      speed_multiplier: speedMultiplier,
      consistency: consistency,
      is_house_nft: true,
      entry_fee_paid: 0,
    });

    if (!insertError) {
      enteredTokenIds.add(pet.tokenId); // Track to avoid duplicates
      insertedNfts.push(pet);
      console.log(`  Added house NFT: ${pet.name} (index ${petIndex}, rarity: ${pet.traits.rarity})`);
    } else {
      console.error('Failed to insert house NFT:', insertError);
    }
  }

  console.log(`Added ${insertedNfts.length} house NFTs to race ${raceId}`);
  return { filled: insertedNfts.length, houseNfts: insertedNfts };
}

// POST /api/admin/races/[id]/resolve - Resolve race and determine results
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raceId } = await context.params;

    // Get race
    const { data: race, error: raceError } = await supabase
      .from('races')
      .select('*')
      .eq('id', raceId)
      .single();

    if (raceError || !race) {
      return NextResponse.json({ error: 'Race not found' }, { status: 404 });
    }

    if (race.status !== 'closed') {
      return NextResponse.json({ error: 'Race must be closed first' }, { status: 400 });
    }

    // Get current entry count
    const { data: currentEntries } = await supabase
      .from('race_entries')
      .select('id')
      .eq('race_id', raceId);

    const currentCount = currentEntries?.length || 0;

    // Check minimum entries met
    if (currentCount < race.min_entries) {
      return NextResponse.json({
        error: `Not enough entries (${currentCount}/${race.min_entries} minimum)`
      }, { status: 400 });
    }

    // Fill remaining spots with house NFTs (provably fair)
    let houseFillResult = { filled: 0, houseNfts: [] as any[] };
    if (currentCount < race.max_entries) {
      console.log(`Filling ${race.max_entries - currentCount} empty spots with house NFTs...`);
      houseFillResult = await fillWithHouseNfts(
        raceId,
        race.server_seed,
        currentCount,
        race.max_entries
      );
    }

    // Get ALL entries (including newly added house NFTs)
    const { data: entries, error: entriesError } = await supabase
      .from('race_entries')
      .select('*')
      .eq('race_id', raceId)
      .order('created_at', { ascending: true });

    if (entriesError) throw entriesError;

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: 'No entries found' }, { status: 400 });
    }

    // Generate combined seed from server seed + all signatures
    const signatures = entries.map(e => e.signature).sort().join('');
    const combinedSeed = createHash('sha256')
      .update(race.server_seed + signatures)
      .digest('hex');

    // Simulate race using combined seed
    const results = simulateRace(entries, combinedSeed);

    // Calculate prize pool - only from paid entries (not house NFTs)
    const paidEntries = entries.filter(e => !e.is_house_nft);
    const totalPool = paidEntries.length * race.entry_fee;
    const prizePool = totalPool * 0.95; // 5% house fee

    console.log(`Prize pool: ${prizePool} nanoERG from ${paidEntries.length} paid entries`);

    // Update entries with results
    for (const result of results) {
      const payout = PAYOUTS.find(p => p.position === result.position);
      const payoutAmount = payout ? Math.floor(prizePool * payout.percentage) : 0;

      await supabase
        .from('race_entries')
        .update({
          final_position: result.position,
          final_distance: result.distance,
          payout_amount: payoutAmount,
        })
        .eq('id', result.entryId);
    }

    // Update race status and reveal seed
    await supabase
      .from('races')
      .update({
        status: 'resolved',
        combined_seed: combinedSeed,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', raceId);

    return NextResponse.json({
      success: true,
      results,
      combinedSeed,
      houseFilled: houseFillResult.filled,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Simulate race
function simulateRace(entries: any[], seed: string) {
  const results = entries.map((entry, i) => {
    // 10 segments per race
    let totalDistance = 0;

    // Use stored multipliers directly (set during entry creation)
    const speedMult = entry.speed_multiplier || 1.0;
    const consistency = entry.consistency || 0.5;

    for (let seg = 0; seg < 10; seg++) {
      const rngIndex = i * 100 + seg;
      const roll = seededRandom(seed, rngIndex) * 100;

      const variance = (1 - consistency) * 40;
      const swing = (seededRandom(seed, rngIndex + 50) - 0.5) * variance;

      totalDistance += (roll + swing) * speedMult;
    }

    return {
      entryId: entry.id,
      nftTokenId: entry.nft_token_id,
      nftName: entry.nft_name,
      nftNumber: entry.nft_number,
      isHouseNft: entry.is_house_nft,
      distance: totalDistance,
      position: 0,
    };
  });

  // Sort by distance (highest wins)
  results.sort((a, b) => b.distance - a.distance);

  // Assign positions
  results.forEach((r, i) => {
    r.position = i + 1;
  });

  return results;
}

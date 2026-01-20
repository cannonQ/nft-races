import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
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

// Simple seeded RNG
function seededRandom(seed: string, index: number): number {
  const hash = createHash('sha256').update(seed + index.toString()).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0xffffffff;
}

/**
 * Pre-populate race with house NFTs (max_entries - 1)
 * These will be replaced as real players join
 */
async function prepopulateWithHouseNfts(
  raceId: string,
  serverSeed: string,
  count: number
): Promise<number> {
  if (count <= 0) return 0;

  // Generate selection seed for this race
  const selectionSeed = createHash('sha256')
    .update(serverSeed + 'PREPOPULATE_' + raceId)
    .digest('hex');

  const totalPets = getCyberPetCount();
  const addedTokenIds = new Set<string>();
  let inserted = 0;
  let attempts = 0;
  const maxAttempts = count * 10;

  while (inserted < count && attempts < maxAttempts) {
    const randomValue = seededRandom(selectionSeed, attempts);
    const petIndex = Math.floor(randomValue * totalPets);
    const pet = getCyberPetByIndex(petIndex);
    attempts++;

    if (!pet || addedTokenIds.has(pet.tokenId)) continue;

    const speedMultiplier = RARITY_MULTIPLIERS[pet.traits.rarity] || 1.0;
    const consistency = 0.5 + pet.traits.bodyParts.length * 0.04;
    const signature = `HOUSE:${raceId}:${pet.tokenId}`;

    const { error } = await supabase.from('race_entries').insert({
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

    if (!error) {
      addedTokenIds.add(pet.tokenId);
      inserted++;
    }
  }

  console.log(`Pre-populated race ${raceId} with ${inserted} house NFTs`);
  return inserted;
}

// GET /api/admin/races - List all races
export async function GET() {
  try {
    const { data: races, error } = await supabase
      .from('races')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ races: races || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/admin/races - Create new race
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, entry_fee, max_entries, min_entries, entry_deadline } = body;

    // Generate server seed and hash
    const serverSeed = randomBytes(32).toString('hex');
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');

    // Create the race (status: open so players can join immediately)
    const { data: race, error } = await supabase
      .from('races')
      .insert({
        name,
        entry_fee,
        max_entries,
        min_entries: min_entries || 2,
        entry_deadline,
        server_seed: serverSeed,
        server_seed_hash: serverSeedHash,
        status: 'open', // Open immediately
      })
      .select()
      .single();

    if (error) throw error;

    // Pre-populate with house NFTs (max_entries - 1)
    // This makes the race look "almost full" - real players replace house NFTs
    const houseFilled = await prepopulateWithHouseNfts(
      race.id,
      serverSeed,
      max_entries - 1
    );

    // Don't expose server_seed in response
    const { server_seed, ...safeRace } = race;

    return NextResponse.json({
      race: safeRace,
      houseFilled,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

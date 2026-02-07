/**
 * POST /api/v2/creatures/register
 *
 * Register a single CyberPet NFT as a creature in the training system.
 * Verifies wallet ownership via the Ergo Explorer API, looks up traits,
 * computes base_stats from the collection template, and inserts creature +
 * creature_stats + prestige rows.
 *
 * Body: { tokenId: string, walletAddress: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCyberPetInfo, isCyberPet } from '@/lib/cyberpets';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenId, walletAddress } = body as {
      tokenId?: string;
      walletAddress?: string;
    };

    // --- Validate inputs ----------------------------------------------------
    if (!tokenId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: tokenId, walletAddress' },
        { status: 400 },
      );
    }

    // --- Verify it's a CyberPet ---------------------------------------------
    if (!isCyberPet(tokenId)) {
      return NextResponse.json(
        { error: 'Token is not a recognized CyberPet NFT' },
        { status: 400 },
      );
    }

    // --- Verify wallet owns the token (Ergo Explorer) -----------------------
    const ownershipRes = await fetch(
      `${EXPLORER_API}/tokens/${tokenId}/boxes?limit=1`,
    );

    if (!ownershipRes.ok) {
      return NextResponse.json(
        { error: 'Failed to verify token ownership via Ergo Explorer' },
        { status: 502 },
      );
    }

    const ownershipData = await ownershipRes.json();
    const boxes = ownershipData.items || [];

    if (boxes.length === 0) {
      return NextResponse.json({ error: 'Token not found on chain' }, { status: 404 });
    }

    const currentOwner: string = boxes[0].address;
    if (currentOwner !== walletAddress) {
      return NextResponse.json(
        { error: `Wallet does not own this token. Current owner: ${currentOwner}` },
        { status: 403 },
      );
    }

    // --- Check if already registered ----------------------------------------
    const { data: existingCreature } = await supabase
      .from('creatures')
      .select('id')
      .eq('token_id', tokenId)
      .single();

    if (existingCreature) {
      return NextResponse.json(
        { error: 'This CyberPet is already registered', creatureId: existingCreature.id },
        { status: 409 },
      );
    }

    // --- Get CyberPet info from local data ----------------------------------
    const petInfo = getCyberPetInfo(tokenId);
    if (!petInfo) {
      return NextResponse.json(
        { error: 'Could not parse CyberPet trait data' },
        { status: 500 },
      );
    }

    // --- Fetch collection template ------------------------------------------
    const { data: collection, error: collErr } = await supabase
      .from('collections')
      .select('id, base_stat_template, trait_mapping')
      .eq('name', 'CyberPets')
      .single();

    if (collErr || !collection) {
      return NextResponse.json(
        { error: 'CyberPets collection not found in database' },
        { status: 500 },
      );
    }

    // --- Fetch active season ------------------------------------------------
    const { data: activeSeason, error: seasonErr } = await supabase
      .from('seasons')
      .select('id')
      .eq('status', 'active')
      .single();

    if (seasonErr || !activeSeason) {
      return NextResponse.json({ error: 'No active season found' }, { status: 400 });
    }

    // --- Compute base stats -------------------------------------------------
    const bodyParts = petInfo.traits.bodyParts;
    const bodyPartCount = bodyParts.length;
    const materialQuality = getMaterialQuality(bodyParts);

    const baseStats = computeBaseStats(
      petInfo.traits.rarity,
      bodyPartCount,
      materialQuality,
      collection.base_stat_template || {},
      collection.trait_mapping || {},
    );

    // --- Insert creature ----------------------------------------------------
    const { data: creatureRow, error: creatureErr } = await supabase
      .from('creatures')
      .insert({
        token_id: tokenId,
        collection_id: collection.id,
        name: petInfo.name,
        owner_address: walletAddress,
        rarity: petInfo.traits.rarity,
        base_stats: baseStats,
        metadata: {
          pet: petInfo.traits.pet,
          skinColor: petInfo.traits.skinColor,
          background: petInfo.traits.background,
          stage: petInfo.traits.stage,
          bodyParts,
          bodyPartCount,
          materialQuality,
          number: petInfo.number,
        },
      })
      .select('id')
      .single();

    if (creatureErr) {
      return NextResponse.json(
        { error: `Failed to create creature: ${creatureErr.message}` },
        { status: 500 },
      );
    }

    const creatureId = creatureRow.id;

    // --- Insert creature_stats for active season ----------------------------
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
      // Attempt cleanup
      await supabase.from('creatures').delete().eq('id', creatureId);
      return NextResponse.json(
        { error: `Failed to create creature stats: ${statsErr.message}` },
        { status: 500 },
      );
    }

    // --- Insert prestige row ------------------------------------------------
    const { error: prestigeErr } = await supabase.from('prestige').insert({
      creature_id: creatureId,
      total_races: 0,
      total_wins: 0,
      total_podiums: 0,
      total_earnings: 0,
      seasons_completed: 0,
    });

    if (prestigeErr) {
      console.error(`Prestige insert failed for ${creatureId}: ${prestigeErr.message}`);
      // Non-fatal — creature and stats are already created
    }

    // --- Response -----------------------------------------------------------
    return NextResponse.json({
      success: true,
      creature: {
        id: creatureId,
        tokenId,
        name: petInfo.name,
        rarity: petInfo.traits.rarity,
        baseStats,
        metadata: {
          pet: petInfo.traits.pet,
          bodyPartCount,
          materialQuality,
        },
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

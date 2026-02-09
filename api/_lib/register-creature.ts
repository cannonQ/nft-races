/**
 * Shared creature registration logic.
 * Used by both POST /creatures/register and auto-discovery in GET /creatures/by-wallet.
 */
import { supabase } from './supabase';
import { isCyberPet, getToken, parseTraits, computeBaseStats } from './cyberpets';

interface RegisterResult {
  success: boolean;
  creatureId?: string;
  error?: string;
}

/**
 * Register a single CyberPet into the DB.
 * Assumes on-chain ownership has ALREADY been verified by the caller.
 */
export async function registerCreature(
  tokenId: string,
  walletAddress: string,
  collectionId: string,
  baseStatTemplate: Record<string, any>,
  traitMapping: Record<string, any>,
  seasonId: string,
): Promise<RegisterResult> {
  if (!isCyberPet(tokenId)) {
    return { success: false, error: 'Not a valid CyberPet' };
  }

  const token = getToken(tokenId);
  if (!token) {
    return { success: false, error: 'Token not found in CyberPets data' };
  }

  const traits = parseTraits(token.description);
  if (!traits) {
    return { success: false, error: 'Failed to parse CyberPet traits' };
  }

  const baseStats = computeBaseStats(
    traits.rarity,
    traits.bodyPartCount,
    traits.materialQuality,
    baseStatTemplate || {},
    traitMapping || {},
  );

  // Insert creature
  const { data: creatureRow, error: creatureErr } = await supabase
    .from('creatures')
    .insert({
      token_id: tokenId,
      collection_id: collectionId,
      name: token.name,
      owner_address: walletAddress,
      rarity: traits.rarity,
      base_stats: baseStats,
      metadata: {
        pet: traits.pet,
        skinColor: traits.skinColor,
        background: traits.background,
        stage: traits.stage,
        bodyParts: traits.bodyParts,
        bodyPartCount: traits.bodyPartCount,
        materialQuality: traits.materialQuality,
        number: token.number,
      },
    })
    .select('id')
    .single();

  if (creatureErr || !creatureRow) {
    console.error('Creature insert error:', creatureErr);
    return { success: false, error: 'Failed to insert creature' };
  }

  // Insert creature_stats for active season
  const { error: statsErr } = await supabase.from('creature_stats').insert({
    creature_id: creatureRow.id,
    season_id: seasonId,
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
    console.error('Stats insert error:', statsErr);
    return { success: false, error: 'Failed to initialize season stats' };
  }

  // Insert prestige row
  const { error: prestigeErr } = await supabase.from('prestige').insert({
    creature_id: creatureRow.id,
    total_races: 0,
    total_wins: 0,
    total_podiums: 0,
    total_earnings: 0,
    seasons_completed: 0,
  });

  if (prestigeErr) {
    console.error('Prestige insert error:', prestigeErr);
    // Non-fatal: creature is registered, prestige can be added later
  }

  return { success: true, creatureId: creatureRow.id };
}

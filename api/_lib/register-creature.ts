/**
 * Shared creature registration logic.
 * Used by both POST /creatures/register and auto-discovery in GET /creatures/by-wallet.
 *
 * Generic: delegates to a CollectionLoader for trait parsing, stat computation, and metadata.
 * creature_stats and prestige rows are NOT created here — lazy init via getOrCreateCreatureStats().
 */
import { supabase } from './supabase.js';
import type { CollectionLoader } from './collections/types.js';

interface RegisterResult {
  success: boolean;
  creatureId?: string;
  error?: string;
}

/**
 * Register a single creature (any collection) into the DB.
 * Assumes on-chain ownership has ALREADY been verified by the caller.
 *
 * No creature_stats or prestige rows are created — lazy init via getOrCreateCreatureStats()
 * handles both on first interaction (training, race entry, or profile view).
 */
export async function registerCreature(
  tokenId: string,
  walletAddress: string,
  collectionId: string,
  baseStatTemplate: Record<string, any>,
  traitMapping: Record<string, any>,
  loader: CollectionLoader,
): Promise<RegisterResult> {
  const token = loader.getToken(tokenId);
  if (!token) {
    return { success: false, error: 'Token not found in collection data' };
  }

  const traits = loader.parseTraits(token);
  if (!traits) {
    return { success: false, error: 'Failed to parse traits' };
  }

  const baseStats = loader.computeBaseStats(traits, baseStatTemplate, traitMapping);
  const metadata = loader.buildMetadata(token, traits);
  const rarity = loader.getRarity(traits);

  // Insert creature
  const { data: creatureRow, error: creatureErr } = await supabase
    .from('creatures')
    .insert({
      token_id: tokenId,
      collection_id: collectionId,
      name: token.name ?? `Token ${tokenId.slice(0, 8)}`,
      owner_address: walletAddress,
      rarity,
      base_stats: baseStats,
      metadata,
    })
    .select('id')
    .single();

  if (creatureErr || !creatureRow) {
    console.error('Creature insert error:', creatureErr);
    return { success: false, error: 'Failed to insert creature' };
  }

  return { success: true, creatureId: creatureRow.id };
}

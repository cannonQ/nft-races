import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { getActiveSeason, getOrCreateCreatureStats, computeCreatureResponse } from '../../_lib/helpers.js';
import { findLoaderForToken, getLoaderBySlug } from '../../_lib/collections/registry.js';
import { verifyNFTOwnership } from '../../../lib/ergo/server.js';
import { registerCreature } from '../../_lib/register-creature.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { tokenId, walletAddress } = req.body ?? {};

  if (!tokenId || !walletAddress) {
    return res.status(400).json({ error: 'tokenId and walletAddress are required' });
  }

  try {
    // 1. Find which collection this token belongs to (via loader registry)
    const loader = findLoaderForToken(tokenId);
    if (!loader) {
      return res.status(400).json({ error: 'Token is not recognized as a valid NFT in any supported collection' });
    }

    // 2. Verify on-chain ownership via Ergo Explorer
    const ownership = await verifyNFTOwnership(walletAddress, tokenId);
    if (!ownership.ownsToken) {
      return res.status(400).json({ error: 'Wallet does not currently own this NFT on-chain' });
    }

    // 3. Fetch collection config from DB (match by loader slug = collections.name)
    const { data: collection, error: collErr } = await supabase
      .from('collections')
      .select('id, base_stat_template, trait_mapping')
      .eq('name', loader.slug)
      .single();

    if (collErr || !collection) {
      return res.status(500).json({ error: `Failed to load collection config for ${loader.slug}` });
    }

    // 4. Check not already registered
    const { data: existing } = await supabase
      .from('creatures')
      .select('id')
      .eq('token_id', tokenId)
      .eq('collection_id', collection.id)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'This NFT is already registered' });
    }

    // 5. Get active season for this collection
    const season = await getActiveSeason(collection.id);
    if (!season) {
      return res.status(400).json({ error: 'No active season for this collection — cannot register outside a season' });
    }

    // 6. Register via shared helper (no creature_stats/prestige — lazy init handles it)
    const result = await registerCreature(
      tokenId,
      walletAddress,
      collection.id,
      collection.base_stat_template || {},
      collection.trait_mapping || {},
      loader,
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to register creature' });
    }

    // 7. Build full CreatureWithStats response
    const { data: creatureRow } = await supabase
      .from('creatures')
      .select('*')
      .eq('id', result.creatureId)
      .single();

    // Lazy init: getOrCreateCreatureStats creates stats + prestige on first access
    const statsRow = await getOrCreateCreatureStats(result.creatureId!, season.id);

    const { data: prestigeRow } = await supabase
      .from('prestige')
      .select('*')
      .eq('creature_id', result.creatureId)
      .single();

    const creature = computeCreatureResponse(creatureRow, statsRow, prestigeRow, 0, [], null, loader);

    return res.status(201).json({ success: true, creature });
  } catch (err) {
    console.error('POST /api/v2/creatures/register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

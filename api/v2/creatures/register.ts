import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';
import { getActiveSeason, computeCreatureResponse, countActionsToday } from '../../_lib/helpers';
import { isCyberPet } from '../../_lib/cyberpets';
import { verifyNFTOwnership } from '../../../lib/ergo/server';
import { registerCreature } from '../../_lib/register-creature';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { tokenId, walletAddress } = req.body ?? {};

  if (!tokenId || !walletAddress) {
    return res.status(400).json({ error: 'tokenId and walletAddress are required' });
  }

  try {
    // 1. Validate token is a known CyberPet
    if (!isCyberPet(tokenId)) {
      return res.status(400).json({ error: 'Token is not a valid CyberPet NFT' });
    }

    // 2. Verify on-chain ownership via Ergo Explorer
    const ownership = await verifyNFTOwnership(walletAddress, tokenId);
    if (!ownership.ownsToken) {
      return res.status(400).json({ error: 'Wallet does not currently own this NFT on-chain' });
    }

    // 3. Fetch collection config
    const { data: collection, error: collErr } = await supabase
      .from('collections')
      .select('id, base_stat_template, trait_mapping')
      .eq('name', 'CyberPets')
      .single();

    if (collErr || !collection) {
      return res.status(500).json({ error: 'Failed to load CyberPets collection config' });
    }

    // 4. Check not already registered
    const { data: existing } = await supabase
      .from('creatures')
      .select('id')
      .eq('token_id', tokenId)
      .eq('collection_id', collection.id)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'This CyberPet is already registered' });
    }

    // 5. Get active season
    const season = await getActiveSeason();
    if (!season) {
      return res.status(400).json({ error: 'No active season — cannot register outside a season' });
    }

    // 6. Register via shared helper
    const result = await registerCreature(
      tokenId,
      walletAddress,
      collection.id,
      collection.base_stat_template || {},
      collection.trait_mapping || {},
      season.id,
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

    const { data: statsRow } = await supabase
      .from('creature_stats')
      .select('*')
      .eq('creature_id', result.creatureId)
      .eq('season_id', season.id)
      .single();

    const { data: prestigeRow } = await supabase
      .from('prestige')
      .select('*')
      .eq('creature_id', result.creatureId)
      .single();

    const creature = computeCreatureResponse(creatureRow, statsRow, prestigeRow, 0);

    return res.status(201).json({ success: true, creature });
  } catch (err) {
    console.error('POST /api/v2/creatures/register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

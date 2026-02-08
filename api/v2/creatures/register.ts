import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';
import { getActiveSeason, computeCreatureResponse, countActionsToday } from '../../_lib/helpers';
import { isCyberPet, getToken, parseTraits, computeBaseStats } from '../../_lib/cyberpets';
import { verifyNFTOwnership } from '../../../lib/ergo/server';

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

    // 3. Fetch collection config (base_stat_template + trait_mapping)
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

    // 6. Parse traits and compute base stats
    const token = getToken(tokenId)!;
    const traits = parseTraits(token.description);
    if (!traits) {
      return res.status(500).json({ error: 'Failed to parse CyberPet traits' });
    }

    const baseStats = computeBaseStats(
      traits.rarity,
      traits.bodyPartCount,
      traits.materialQuality,
      collection.base_stat_template || {},
      collection.trait_mapping || {},
    );

    // 7. Insert creature
    const { data: creatureRow, error: creatureErr } = await supabase
      .from('creatures')
      .insert({
        token_id: tokenId,
        collection_id: collection.id,
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
      .select('*')
      .single();

    if (creatureErr || !creatureRow) {
      console.error('Creature insert error:', creatureErr);
      return res.status(500).json({ error: 'Failed to register creature' });
    }

    // 8. Insert creature_stats for active season
    const { error: statsErr } = await supabase.from('creature_stats').insert({
      creature_id: creatureRow.id,
      season_id: season.id,
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
      return res.status(500).json({ error: 'Failed to initialize season stats' });
    }

    // 9. Insert prestige row
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

    // 10. Build full CreatureWithStats response
    const { data: statsRow } = await supabase
      .from('creature_stats')
      .select('*')
      .eq('creature_id', creatureRow.id)
      .eq('season_id', season.id)
      .single();

    const { data: prestigeRow } = await supabase
      .from('prestige')
      .select('*')
      .eq('creature_id', creatureRow.id)
      .single();

    const creature = computeCreatureResponse(creatureRow, statsRow, prestigeRow, 0);

    return res.status(201).json({ success: true, creature });
  } catch (err) {
    console.error('POST /api/v2/creatures/register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

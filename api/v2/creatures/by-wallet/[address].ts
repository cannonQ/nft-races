import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { getActiveSeason, getLatestErgoBlock, getUtcMidnightToday, computeCreatureResponse } from '../../../_lib/helpers.js';
import { isCyberPet } from '../../../_lib/cyberpets.js';
import { fetchAddressBalanceWithFallback } from '../../../../lib/ergo/server.js';
import { registerCreature } from '../../../_lib/register-creature.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const address = req.query.address as string;
  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    const season = await getActiveSeason();

    // 1. Fetch ALL tokens in wallet from Explorer (single API call)
    const balance = await fetchAddressBalanceWithFallback(address);
    if (!balance) {
      return res.status(200).json([]);
    }

    // 2. Filter to CyberPets held on-chain
    const onChainCyberPets = balance.tokens.filter(
      t => t.amount > 0 && isCyberPet(t.tokenId)
    );
    const onChainTokenIds = onChainCyberPets.map(t => t.tokenId);

    // 3. If wallet holds no CyberPets, clear stale DB entries and return empty
    if (onChainTokenIds.length === 0) {
      await supabase
        .from('creatures')
        .update({ owner_address: null })
        .eq('owner_address', address);
      return res.status(200).json([]);
    }

    // 4. Fetch DB creatures matching these token IDs (regardless of owner_address)
    const { data: dbCreatures } = await supabase
      .from('creatures')
      .select('*')
      .in('token_id', onChainTokenIds);

    const dbByTokenId = new Map<string, any>(
      (dbCreatures ?? []).map((c: any) => [c.token_id, c])
    );

    // 5. Auto-register missing creatures
    if (season) {
      const missingTokenIds = onChainTokenIds.filter(id => !dbByTokenId.has(id));

      if (missingTokenIds.length > 0) {
        const { data: collection } = await supabase
          .from('collections')
          .select('id, base_stat_template, trait_mapping')
          .eq('name', 'CyberPets')
          .single();

        if (collection) {
          for (const tokenId of missingTokenIds) {
            const result = await registerCreature(
              tokenId,
              address,
              collection.id,
              collection.base_stat_template ?? {},
              collection.trait_mapping ?? {},
              season.id,
            );
            if (result.success && result.creatureId) {
              const { data: newCreature } = await supabase
                .from('creatures')
                .select('*')
                .eq('id', result.creatureId)
                .single();
              if (newCreature) {
                dbByTokenId.set(tokenId, newCreature);
              }
            }
          }
        }
      }
    }

    // 6. Update ownership for creatures with wrong/null owner_address (re-claim)
    const ownedCreatures: any[] = [];
    for (const tokenId of onChainTokenIds) {
      const creature = dbByTokenId.get(tokenId);
      if (creature) {
        if (creature.owner_address !== address) {
          await supabase
            .from('creatures')
            .update({ owner_address: address })
            .eq('id', creature.id);
          creature.owner_address = address;
        }
        ownedCreatures.push(creature);
      }
    }

    // 7. Clear stale ownership for creatures this wallet used to own but no longer holds
    const ownedTokenIdSet = new Set(onChainTokenIds);
    const { data: formerlyOwned } = await supabase
      .from('creatures')
      .select('id, token_id')
      .eq('owner_address', address);

    const staleIds = (formerlyOwned ?? [])
      .filter((c: any) => !ownedTokenIdSet.has(c.token_id))
      .map((c: any) => c.id);

    if (staleIds.length > 0) {
      await supabase
        .from('creatures')
        .update({ owner_address: null })
        .in('id', staleIds);
    }

    if (ownedCreatures.length === 0) {
      return res.status(200).json([]);
    }

    // 8. Get current block height for boost expiry filtering
    let currentBlockHeight = 0;
    if (season) {
      const { height } = await getLatestErgoBlock();
      currentBlockHeight = height;
    }

    // 9. Batch fetch creature_stats, prestige, training logs, and boost rewards
    const creatureIds = ownedCreatures.map((c: any) => c.id);

    const [statsResult, prestigeResult, logsResult, boostsResult, leaderboardResult] = await Promise.all([
      season
        ? supabase
            .from('creature_stats')
            .select('*')
            .eq('season_id', season.id)
            .in('creature_id', creatureIds)
        : { data: [] },
      supabase
        .from('prestige')
        .select('*')
        .in('creature_id', creatureIds),
      season
        ? supabase
            .from('training_log')
            .select('creature_id')
            .in('creature_id', creatureIds)
            .eq('season_id', season.id)
            .eq('bonus_action', false)
            .gte('created_at', getUtcMidnightToday())
        : { data: [] },
      season
        ? supabase
            .from('boost_rewards')
            .select('*')
            .in('creature_id', creatureIds)
            .eq('season_id', season.id)
            .is('spent_at', null)
            .gt('expires_at_height', currentBlockHeight)
        : { data: [] },
      season
        ? supabase
            .from('season_leaderboard')
            .select('*')
            .eq('season_id', season.id)
            .in('creature_id', creatureIds)
        : { data: [] },
    ]);

    const statsMap = new Map<string, any>();
    for (const s of (statsResult.data ?? [])) {
      statsMap.set(s.creature_id, s);
    }

    const prestigeMap = new Map<string, any>();
    for (const p of (prestigeResult.data ?? [])) {
      prestigeMap.set(p.creature_id, p);
    }

    const actionCountMap = new Map<string, number>();
    for (const log of (logsResult.data ?? [])) {
      const current = actionCountMap.get(log.creature_id) ?? 0;
      actionCountMap.set(log.creature_id, current + 1);
    }

    const boostsMap = new Map<string, any[]>();
    for (const b of (boostsResult.data ?? [])) {
      const arr = boostsMap.get(b.creature_id) ?? [];
      arr.push(b);
      boostsMap.set(b.creature_id, arr);
    }

    const leaderboardMap = new Map<string, any>();
    for (const lb of (leaderboardResult.data ?? [])) {
      leaderboardMap.set(lb.creature_id, lb);
    }

    // 10. Assemble responses
    const result = ownedCreatures.map((creature: any) => {
      const stats = statsMap.get(creature.id) ?? null;
      const prestige = prestigeMap.get(creature.id) ?? null;
      const actionsToday = actionCountMap.get(creature.id) ?? 0;
      const boosts = boostsMap.get(creature.id) ?? [];
      const leaderboard = leaderboardMap.get(creature.id) ?? null;
      return computeCreatureResponse(creature, stats, prestige, actionsToday, boosts, leaderboard);
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/creatures/by-wallet error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

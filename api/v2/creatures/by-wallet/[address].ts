import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { getActiveSeasons, getLatestErgoBlock, getUtcMidnightToday, computeCreatureResponse } from '../../../_lib/helpers.js';
import { getCollectionLoaders, getLoaderBySlug } from '../../../_lib/collections/registry.js';
import type { CollectionLoader } from '../../../_lib/collections/types.js';
import { fetchAddressBalanceWithFallback } from '../../../../lib/ergo/server.js';
import { registerCreature } from '../../../_lib/register-creature.js';
import { getGameConfig } from '../../../_lib/config.js';
import { checkAndCompleteTreatment } from '../../../_lib/execute-treatment.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const address = req.query.address as string;
  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    // 1. Fetch active seasons (one per collection) and all collections from DB
    const [seasons, { data: dbCollections }] = await Promise.all([
      getActiveSeasons(),
      supabase.from('collections').select('id, name, base_stat_template, trait_mapping'),
    ]);

    // Build lookup: collectionId → season
    const seasonByCollectionId = new Map<string, any>();
    for (const s of seasons) {
      seasonByCollectionId.set(s.collection_id, s);
    }

    const hasAnySeason = seasons.length > 0;

    // 2. Fetch ALL tokens in wallet from Explorer (single API call)
    const balance = await fetchAddressBalanceWithFallback(address);
    if (!balance) {
      return res.status(200).json([]);
    }

    // 3. Identify which wallet tokens belong to which collections (via loaders)
    const walletTokens = balance.tokens.filter(t => t.amount > 0);
    const matchedTokens: Array<{
      tokenId: string;
      collectionId: string;
      loader: CollectionLoader;
      dbCollection: any;
    }> = [];

    for (const col of (dbCollections ?? [])) {
      const loader = getLoaderBySlug(col.name);
      if (!loader) continue;

      for (const t of walletTokens) {
        if (loader.isToken(t.tokenId)) {
          matchedTokens.push({
            tokenId: t.tokenId,
            collectionId: col.id,
            loader,
            dbCollection: col,
          });
        }
      }
    }

    const onChainTokenIds = matchedTokens.map(m => m.tokenId);

    // 4. If wallet holds no recognized NFTs, clear stale DB entries and return empty
    if (onChainTokenIds.length === 0) {
      await supabase
        .from('creatures')
        .update({ owner_address: null })
        .eq('owner_address', address);
      return res.status(200).json([]);
    }

    // 5. Fetch DB creatures matching these token IDs (regardless of owner_address)
    const { data: dbCreatures } = await supabase
      .from('creatures')
      .select('*')
      .in('token_id', onChainTokenIds);

    const dbByTokenId = new Map<string, any>(
      (dbCreatures ?? []).map((c: any) => [c.token_id, c])
    );

    // 6. Auto-register missing creatures (for any collection with an active season)
    if (hasAnySeason) {
      const missingTokens = matchedTokens.filter(m => !dbByTokenId.has(m.tokenId));

      for (const missing of missingTokens) {
        // Only auto-register if the collection has an active season
        const season = seasonByCollectionId.get(missing.collectionId);
        if (!season) continue;

        const result = await registerCreature(
          missing.tokenId,
          address,
          missing.collectionId,
          missing.dbCollection.base_stat_template ?? {},
          missing.dbCollection.trait_mapping ?? {},
          missing.loader,
        );
        if (result.success && result.creatureId) {
          const { data: newCreature } = await supabase
            .from('creatures')
            .select('*')
            .eq('id', result.creatureId)
            .single();
          if (newCreature) {
            dbByTokenId.set(missing.tokenId, newCreature);
          }
        }
      }
    }

    // 7. Update ownership for creatures with wrong/null owner_address (re-claim)
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

    // 8. Clear stale ownership for creatures this wallet used to own but no longer holds
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

    // 9. Get current block height for boost expiry filtering
    let currentBlockHeight = 0;
    if (hasAnySeason) {
      const { height } = await getLatestErgoBlock();
      currentBlockHeight = height;
    }

    // 10. Batch fetch creature_stats, prestige, training logs, boost rewards, leaderboard
    //     across ALL active seasons (each creature uses its collection's season)
    const creatureIds = ownedCreatures.map((c: any) => c.id);
    const allSeasonIds = seasons.map((s: any) => s.id);

    const [statsResult, prestigeResult, logsResult, boostsResult, leaderboardResult] = await Promise.all([
      allSeasonIds.length > 0
        ? supabase
            .from('creature_stats')
            .select('*')
            .in('season_id', allSeasonIds)
            .in('creature_id', creatureIds)
        : { data: [] },
      supabase
        .from('prestige')
        .select('*')
        .in('creature_id', creatureIds),
      allSeasonIds.length > 0
        ? supabase
            .from('training_log')
            .select('creature_id, created_at')
            .in('creature_id', creatureIds)
            .in('season_id', allSeasonIds)
            .eq('bonus_action', false)
            .gte('created_at', getUtcMidnightToday())
        : { data: [] },
      allSeasonIds.length > 0
        ? supabase
            .from('boost_rewards')
            .select('*')
            .in('creature_id', creatureIds)
            .in('season_id', allSeasonIds)
            .is('spent_at', null)
            .gt('expires_at_height', currentBlockHeight)
        : { data: [] },
      allSeasonIds.length > 0
        ? supabase
            .from('season_leaderboard')
            .select('*')
            .in('season_id', allSeasonIds)
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
    const lastRegularActionMap = new Map<string, string>();
    for (const log of (logsResult.data ?? [])) {
      const current = actionCountMap.get(log.creature_id) ?? 0;
      actionCountMap.set(log.creature_id, current + 1);
      // Track most recent regular action (logs are not ordered, so compare)
      const prev = lastRegularActionMap.get(log.creature_id);
      if (!prev || log.created_at > prev) {
        lastRegularActionMap.set(log.creature_id, log.created_at);
      }
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

    // Build loader lookup by collection name for image/name resolution
    const loadersByCollectionId = new Map<string, CollectionLoader>();
    for (const col of (dbCollections ?? [])) {
      const loader = getLoaderBySlug(col.name);
      if (loader) loadersByCollectionId.set(col.id, loader);
    }

    // Pre-fetch game configs per collection (for scaled condition decay)
    const gameConfigByCollectionId = new Map<string, Record<string, any>>();
    const uniqueCollectionIds = [...new Set(ownedCreatures.map((c: any) => c.collection_id))];
    await Promise.all(uniqueCollectionIds.map(async (colId: string) => {
      const cfg = await getGameConfig(colId);
      if (cfg) gameConfigByCollectionId.set(colId, cfg);
    }));

    // 11. Lazy treatment completion for creatures with expired treatments
    const treatmentCompletions = ownedCreatures
      .filter((c: any) => {
        const s = statsMap.get(c.id);
        return s?.treatment_type && s.treatment_ends_at && new Date(s.treatment_ends_at) <= new Date();
      })
      .map(async (c: any) => {
        const s = statsMap.get(c.id)!;
        const cfg = gameConfigByCollectionId.get(c.collection_id);
        const completed = await checkAndCompleteTreatment(c.id, s.season_id, cfg);
        if (completed) {
          const { data: refreshed } = await supabase
            .from('creature_stats')
            .select('*')
            .eq('creature_id', c.id)
            .eq('season_id', s.season_id)
            .single();
          if (refreshed) statsMap.set(c.id, refreshed);
        }
      });
    if (treatmentCompletions.length > 0) {
      await Promise.all(treatmentCompletions);
    }

    // 12. Assemble responses
    const result = ownedCreatures.map((creature: any) => {
      const stats = statsMap.get(creature.id) ?? null;
      const prestige = prestigeMap.get(creature.id) ?? null;
      const actionsToday = actionCountMap.get(creature.id) ?? 0;
      const boosts = boostsMap.get(creature.id) ?? [];
      const leaderboard = leaderboardMap.get(creature.id) ?? null;
      const lastRegularAction = lastRegularActionMap.get(creature.id) ?? null;
      const loader = loadersByCollectionId.get(creature.collection_id);
      const gameConfig = gameConfigByCollectionId.get(creature.collection_id);
      return computeCreatureResponse(creature, stats, prestige, actionsToday, boosts, leaderboard, loader, lastRegularAction, gameConfig);
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('GET /api/v2/creatures/by-wallet error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

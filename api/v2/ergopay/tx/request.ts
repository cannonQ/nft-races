/**
 * POST /api/v2/ergopay/tx/request
 *
 * Creates an ErgoPay payment request for training or race entry fees.
 * 1. Validates the action (ownership, cooldown, race open, etc.) — fail early before payment
 * 2. Builds an unsigned TX with R4-R6 metadata registers (action type, token ID, context)
 * 3. POSTs to ergopay.duckdns.org/api/v1/reducedTx — wallet signs the full TX with registers
 * 4. Stores in ergopay_tx_requests with action payload
 * 5. Returns { requestId, ergoPayUrl, amount }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { supabase } from '../../../_lib/supabase.js';
import { TREASURY_ADDRESS, TRAINING_FEE_NANOERG, REQUIRE_FEES } from '../../../_lib/constants.js';
import { getActiveSeason, getOrCreateCreatureStats } from '../../../_lib/helpers.js';
import { getGameConfig } from '../../../_lib/config.js';
import { validateTrainingAction } from '../../../../lib/training-engine.js';
import { verifyNFTOwnership } from '../../../../lib/ergo/server.js';
import { buildUnsignedTx, buildUnsignedBatchTx, buildUnsignedTokenFeeTx, buildUnsignedBatchTokenFeeTx, type TxMetadata } from '../../../_lib/ergo-tx-builder.js';
import { checkRateLimit, getClientIp } from '../../../_lib/rate-limit.js';

const ERGOPAY_BASE = 'https://ergopay.duckdns.org';

/** Map DB collection name to user-facing dApp name (for wallet TX descriptions) */
function getAppName(collectionName: string): string {
  switch (collectionName) {
    case 'Aneta Angels': return 'Aneta Angel Racing';
    case 'CyberPets': return 'CyberPets Racing';
    default: return `${collectionName} Racing`;
  }
}

/** Generate a high-entropy request ID (32 hex chars = 128 bits) */
function generateRequestId(): string {
  return randomBytes(16).toString('hex').toUpperCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const rl = checkRateLimit(`${getClientIp(req)}:ergopay-tx`, 10, 60_000);
  if (rl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }

  if (!REQUIRE_FEES) {
    return res.status(400).json({ error: 'Fees are not currently required' });
  }

  if (!TREASURY_ADDRESS) {
    return res.status(500).json({ error: 'Treasury address not configured' });
  }

  const {
    actionType,
    walletAddress,
    creatureId,
    creatureIds,
    raceId,
    activity,
    boostRewardIds,
    treatmentType,
    paymentCurrency,
    creatures: batchCreatures,
  } = req.body ?? {};

  if (!actionType || !walletAddress) {
    return res.status(400).json({ error: 'actionType and walletAddress are required' });
  }

  if (actionType !== 'training_fee' && actionType !== 'race_entry_fee' && actionType !== 'treatment_fee') {
    return res.status(400).json({ error: 'actionType must be training_fee, race_entry_fee, or treatment_fee' });
  }

  try {
    let amountNanoerg: number;
    let message: string;
    let unsignedTx: any;
    // For DB storage — single creature actions use creatureId, batch uses first creature
    let dbCreatureId: string | null = null;
    // isBatch flag for race entry
    let isBatch = false;
    // Token payment response fields
    let tokenAmount: number | undefined;
    let tokenName: string | undefined;
    let feeTokenIdForPayload: string | undefined;

    if (actionType === 'training_fee') {
      // Support both single creature and batch creatures[]
      interface BatchCreature { creatureId: string; activity: string; boostRewardIds?: string[]; recoveryRewardIds?: string[]; }
      const resolvedCreatures: BatchCreature[] = Array.isArray(batchCreatures) && batchCreatures.length > 0
        ? batchCreatures
        : creatureId && activity ? [{ creatureId, activity, boostRewardIds }] : [];

      if (resolvedCreatures.length === 0) {
        return res.status(400).json({ error: 'creatureId+activity or creatures[] array is required for training' });
      }

      isBatch = resolvedCreatures.length > 1;
      const txEntries: Array<{ amountNanoErg: number; metadata: TxMetadata }> = [];
      let appName = '';
      let collectionId: string | null = null;
      let mergedConfig: any = null;

      // Pre-validate ALL creatures atomically (reject entire batch if any fail)
      for (const c of resolvedCreatures) {
        if (!c.creatureId || !c.activity) {
          return res.status(400).json({ error: 'Each creature must have creatureId and activity' });
        }

        const { data: creature, error: creatureErr } = await supabase
          .from('creatures')
          .select('id, token_id, owner_address, collection_id, collections(name)')
          .eq('id', c.creatureId)
          .single();

        if (creatureErr || !creature) {
          return res.status(400).json({ error: `Creature ${c.creatureId} not found` });
        }

        // Enforce same collection for batch
        if (collectionId && creature.collection_id !== collectionId) {
          return res.status(400).json({ error: 'All creatures in a batch must belong to the same collection' });
        }
        collectionId = creature.collection_id;

        const ownership = await verifyNFTOwnership(walletAddress, creature.token_id);
        if (!ownership.ownsToken) {
          return res.status(403).json({ error: `You do not own creature ${c.creatureId} on-chain` });
        }

        const season = await getActiveSeason(creature.collection_id);
        if (!season) {
          return res.status(400).json({ error: 'No active season for this collection' });
        }

        if (!mergedConfig) {
          mergedConfig = await getGameConfig(creature.collection_id);
        }
        await getOrCreateCreatureStats(c.creatureId, season.id);
        const validation = await validateTrainingAction(c.creatureId, season.id, supabase, mergedConfig);
        if (!validation.valid) {
          return res.status(400).json({ error: `Creature ${c.creatureId}: ${validation.reason}` });
        }

        if (!appName) {
          appName = getAppName((creature as any).collections?.name || 'NFT');
        }

        txEntries.push({
          amountNanoErg: TRAINING_FEE_NANOERG,
          metadata: { actionType: 'train', tokenId: creature.token_id, context: c.activity },
        });
      }

      dbCreatureId = resolvedCreatures[0].creatureId;
      amountNanoerg = TRAINING_FEE_NANOERG * resolvedCreatures.length;

      if (paymentCurrency === 'token') {
        const feeTokenConfig = mergedConfig?.fee_token;
        if (!feeTokenConfig?.token_id || !feeTokenConfig.training_fee) {
          return res.status(400).json({ error: 'Token payments not available for this collection' });
        }
        feeTokenIdForPayload = feeTokenConfig.token_id;
        tokenAmount = feeTokenConfig.training_fee * resolvedCreatures.length;
        tokenName = feeTokenConfig.name || 'TOKEN';
        const tokenDecimals = feeTokenConfig.decimals ?? 0;
        const rawPerEntry = BigInt(feeTokenConfig.training_fee) * BigInt(10 ** tokenDecimals);

        if (isBatch) {
          message = `${appName}: Training x${resolvedCreatures.length} (${tokenAmount} ${tokenName})`;
          unsignedTx = await buildUnsignedBatchTokenFeeTx({
            senderAddress: walletAddress,
            treasuryAddress: TREASURY_ADDRESS,
            feeTokenId: feeTokenConfig.token_id,
            entries: txEntries.map(e => ({
              feeTokenAmount: rawPerEntry,
              metadata: e.metadata,
            })),
          });
        } else {
          message = `${appName}: Training Fee (${feeTokenConfig.training_fee} ${tokenName})`;
          unsignedTx = await buildUnsignedTokenFeeTx({
            senderAddress: walletAddress,
            treasuryAddress: TREASURY_ADDRESS,
            feeTokenId: feeTokenConfig.token_id,
            feeTokenAmount: rawPerEntry,
            metadata: txEntries[0].metadata,
          });
        }
      } else {
        const ergTotal = (amountNanoerg / 1_000_000_000).toFixed(4);
        if (isBatch) {
          message = `${appName}: Training x${resolvedCreatures.length} (${ergTotal} ERG)`;
          unsignedTx = await buildUnsignedBatchTx({
            senderAddress: walletAddress,
            treasuryAddress: TREASURY_ADDRESS,
            entries: txEntries,
          });
        } else {
          message = `${appName}: Training Fee (0.01 ERG)`;
          unsignedTx = await buildUnsignedTx({
            senderAddress: walletAddress,
            treasuryAddress: TREASURY_ADDRESS,
            amountNanoErg: TRAINING_FEE_NANOERG,
            metadata: txEntries[0].metadata,
          });
        }
      }

    } else if (actionType === 'race_entry_fee') {
      // Support both single creatureId and batch creatureIds[]
      const resolvedIds: string[] = Array.isArray(creatureIds) && creatureIds.length > 0
        ? creatureIds
        : creatureId ? [creatureId] : [];

      if (resolvedIds.length === 0 || !raceId) {
        return res.status(400).json({ error: 'creatureId (or creatureIds[]) and raceId are required for race entry' });
      }

      isBatch = resolvedIds.length > 1;

      // Verify race exists, is open
      const { data: race, error: raceErr } = await supabase
        .from('season_races')
        .select('*, seasons!inner(collection_id)')
        .eq('id', raceId)
        .single();

      if (raceErr || !race) {
        return res.status(400).json({ error: 'Race not found' });
      }
      if (race.status !== 'open') {
        return res.status(400).json({ error: `Race is not open (status: ${race.status})` });
      }
      if (new Date(race.entry_deadline) < new Date()) {
        return res.status(400).json({ error: 'Race entry deadline has passed' });
      }

      const perEntryFee = race.entry_fee_nanoerg ?? 0;
      if (perEntryFee <= 0) {
        return res.status(400).json({ error: 'This race has no entry fee' });
      }

      // Check race capacity for all entries
      const { count: entryCount } = await supabase
        .from('season_race_entries')
        .select('*', { count: 'exact', head: true })
        .eq('race_id', raceId);

      const remaining = race.max_entries - (entryCount ?? 0);
      if (remaining < resolvedIds.length) {
        return res.status(400).json({
          error: `Race only has ${remaining} spot(s) remaining but you selected ${resolvedIds.length} creatures`,
        });
      }

      // Validate all creatures: ownership, collection, not already entered
      const raceCollectionId = race.seasons?.collection_id;
      const txEntries: Array<{ amountNanoErg: number; metadata: TxMetadata }> = [];
      let appName = '';

      for (const cId of resolvedIds) {
        const { data: creature, error: creatureErr } = await supabase
          .from('creatures')
          .select('id, token_id, owner_address, collection_id, collections(name)')
          .eq('id', cId)
          .single();

        if (creatureErr || !creature) {
          return res.status(400).json({ error: `Creature ${cId} not found` });
        }

        const ownership = await verifyNFTOwnership(walletAddress, creature.token_id);
        if (!ownership.ownsToken) {
          return res.status(403).json({ error: `You do not own creature ${cId} on-chain` });
        }

        if (raceCollectionId && creature.collection_id !== raceCollectionId) {
          return res.status(400).json({ error: `Creature ${cId}: collection mismatch` });
        }

        const { data: existing } = await supabase
          .from('season_race_entries')
          .select('id')
          .eq('race_id', raceId)
          .eq('creature_id', cId)
          .limit(1);

        if (existing && existing.length > 0) {
          return res.status(400).json({ error: `Creature ${cId} is already entered in this race` });
        }

        if (!appName) {
          appName = getAppName((creature as any).collections?.name || 'NFT');
        }

        txEntries.push({
          amountNanoErg: perEntryFee,
          metadata: { actionType: 'race', tokenId: creature.token_id, context: raceId },
        });
      }

      dbCreatureId = resolvedIds[0];
      amountNanoerg = perEntryFee * resolvedIds.length;

      if (paymentCurrency === 'token') {
        // Look up token fee config for the race's collection
        const raceConfig = await getGameConfig(raceCollectionId ?? undefined);
        const feeTokenConfig = raceConfig?.fee_token;
        // Use race-specific token fee, fall back to collection default
        const perEntryToken = race.entry_fee_token ?? feeTokenConfig?.default_race_entry_fee ?? null;
        if (!feeTokenConfig?.token_id || !perEntryToken) {
          return res.status(400).json({ error: 'Token payments not available for this race' });
        }
        feeTokenIdForPayload = feeTokenConfig.token_id;
        tokenAmount = perEntryToken * resolvedIds.length;
        tokenName = feeTokenConfig.name || 'TOKEN';
        const raceTokenDecimals = feeTokenConfig.decimals ?? 0;
        const rawPerEntry = BigInt(perEntryToken) * BigInt(10 ** raceTokenDecimals);

        if (isBatch) {
          message = `${appName}: Race Entry x${resolvedIds.length} (${tokenAmount} ${tokenName})`;
          unsignedTx = await buildUnsignedBatchTokenFeeTx({
            senderAddress: walletAddress,
            treasuryAddress: TREASURY_ADDRESS,
            feeTokenId: feeTokenConfig.token_id,
            entries: txEntries.map(e => ({
              feeTokenAmount: rawPerEntry,
              metadata: e.metadata,
            })),
          });
        } else {
          message = `${appName}: Race Entry (${tokenAmount} ${tokenName})`;
          unsignedTx = await buildUnsignedTokenFeeTx({
            senderAddress: walletAddress,
            treasuryAddress: TREASURY_ADDRESS,
            feeTokenId: feeTokenConfig.token_id,
            feeTokenAmount: rawPerEntry,
            metadata: txEntries[0].metadata,
          });
        }
      } else {
        const ergTotal = (amountNanoerg / 1_000_000_000).toFixed(4);
        if (isBatch) {
          message = `${appName}: Race Entry x${resolvedIds.length} (${ergTotal} ERG)`;
          unsignedTx = await buildUnsignedBatchTx({
            senderAddress: walletAddress,
            treasuryAddress: TREASURY_ADDRESS,
            entries: txEntries,
          });
        } else {
          message = `${appName}: Race Entry (${ergTotal} ERG)`;
          unsignedTx = await buildUnsignedTx({
            senderAddress: walletAddress,
            treasuryAddress: TREASURY_ADDRESS,
            amountNanoErg: perEntryFee,
            metadata: txEntries[0].metadata,
          });
        }
      }

    } else {
      // treatment_fee
      if (!creatureId || !treatmentType) {
        return res.status(400).json({ error: 'creatureId and treatmentType are required for treatment' });
      }

      // Verify creature + ownership
      const { data: creature, error: creatureErr } = await supabase
        .from('creatures')
        .select('id, token_id, owner_address, collection_id, collections(name)')
        .eq('id', creatureId)
        .single();

      if (creatureErr || !creature) {
        return res.status(400).json({ error: 'Creature not found' });
      }

      const ownership = await verifyNFTOwnership(walletAddress, creature.token_id);
      if (!ownership.ownsToken) {
        return res.status(403).json({ error: 'You no longer own this NFT on-chain' });
      }

      const season = await getActiveSeason(creature.collection_id);
      if (!season) {
        return res.status(400).json({ error: 'No active season for this collection' });
      }

      const mergedConfig = await getGameConfig(creature.collection_id);
      const treatments = mergedConfig?.treatments ?? {};
      const treatmentDef = treatments[treatmentType];
      if (!treatmentDef) {
        return res.status(400).json({ error: `Unknown treatment type: ${treatmentType}` });
      }

      // Check creature stats — not already in treatment
      const stats = await getOrCreateCreatureStats(creatureId, season.id);
      if (stats?.treatment_type && stats.treatment_ends_at) {
        if (new Date(stats.treatment_ends_at) > new Date()) {
          return res.status(400).json({ error: 'Creature is already in treatment' });
        }
      }

      dbCreatureId = creatureId;
      amountNanoerg = treatmentDef.cost_nanoerg;
      if (amountNanoerg <= 0) {
        return res.status(400).json({ error: 'This treatment has no fee' });
      }

      const appName = getAppName((creature as any).collections?.name || 'NFT');
      const metadata: TxMetadata = { actionType: 'treatment', tokenId: creature.token_id, context: treatmentType };

      if (paymentCurrency === 'token') {
        const feeTokenConfig = mergedConfig?.fee_token;
        const treatmentToken = feeTokenConfig?.treatment_fees?.[treatmentType];
        if (!feeTokenConfig?.token_id || !treatmentToken) {
          return res.status(400).json({ error: 'Token payments not available for this treatment' });
        }
        feeTokenIdForPayload = feeTokenConfig.token_id;
        tokenAmount = treatmentToken;
        tokenName = feeTokenConfig.name || 'TOKEN';
        const treatmentDecimals = feeTokenConfig.decimals ?? 0;
        message = `${appName}: Treatment - ${treatmentDef.name} (${tokenAmount} ${tokenName})`;
        unsignedTx = await buildUnsignedTokenFeeTx({
          senderAddress: walletAddress,
          treasuryAddress: TREASURY_ADDRESS,
          feeTokenId: feeTokenConfig.token_id,
          feeTokenAmount: BigInt(tokenAmount) * BigInt(10 ** treatmentDecimals),
          metadata,
        });
      } else {
        const ergAmount = (amountNanoerg / 1_000_000_000).toFixed(4);
        message = `${appName}: Treatment - ${treatmentDef.name} (${ergAmount} ERG)`;
        unsignedTx = await buildUnsignedTx({
          senderAddress: walletAddress,
          treasuryAddress: TREASURY_ADDRESS,
          amountNanoErg: amountNanoerg,
          metadata,
        });
      }
    }

    // Generate our own request ID (we insert into DB first, then reference in replyTo)
    const requestId = generateRequestId();

    // Resolve creatureIds for storage in action_payload
    const resolvedCreatureIds: string[] = Array.isArray(creatureIds) && creatureIds.length > 0
      ? creatureIds
      : creatureId ? [creatureId] : [];

    // Build action_payload — batch training stores per-creature config in `creatures` key
    const actionPayload: Record<string, any> = {
      activity: activity ?? null,
      boostRewardIds: boostRewardIds ?? null,
      treatmentType: treatmentType ?? null,
      creatureIds: (isBatch && actionType === 'race_entry_fee') ? resolvedCreatureIds : null,
      paymentCurrency: paymentCurrency ?? null,
      feeTokenId: feeTokenIdForPayload ?? null,
      feeTokenAmount: tokenAmount ?? null,
    };

    // For batch training, store per-creature activity/boost/recovery config
    if (actionType === 'training_fee' && Array.isArray(batchCreatures) && batchCreatures.length > 1) {
      actionPayload.creatures = batchCreatures;
    }

    // Store in ergopay_tx_requests BEFORE calling the service
    const { error: insertErr } = await supabase.from('ergopay_tx_requests').insert({
      id: requestId,
      wallet_address: walletAddress,
      action_type: actionType,
      amount_nanoerg: amountNanoerg,
      creature_id: dbCreatureId,
      race_id: raceId ?? null,
      action_payload: actionPayload,
      payment_currency: paymentCurrency === 'token' ? 'token' : 'erg',
      status: 'pending',
    });

    if (insertErr) {
      console.error('Failed to store ergopay_tx_request:', insertErr);
      return res.status(500).json({ error: 'Failed to store payment request' });
    }

    // Build callback URL for wallet to POST signed TX ID
    const host = process.env.ERGOPAY_HOST || process.env.VERCEL_URL || 'localhost:3000';
    const replyTo = `https://${host}/api/v2/ergopay/tx/callback/${requestId}`;

    // POST to ergopay.duckdns.org/api/v1/reducedTx
    const reducedTxPayload = {
      address: walletAddress,
      message,
      messageSeverity: 'INFORMATION',
      replyTo,
      unsignedTx,
    };

    const reducedTxResp = await fetch(`${ERGOPAY_BASE}/api/v1/reducedTx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reducedTxPayload),
    });

    if (!reducedTxResp.ok) {
      const body = await reducedTxResp.text();
      console.error('ergopay.duckdns.org reducedTx failed:', reducedTxResp.status, body);
      console.error('reducedTx payload that failed:', JSON.stringify(reducedTxPayload, null, 2));
      // Clean up
      await supabase.from('ergopay_tx_requests').delete().eq('id', requestId);
      return res.status(502).json({
        error: 'Failed to create payment request with the ErgoPay service',
        relayStatus: reducedTxResp.status,
        relayBody: body,
      });
    }

    const reducedData = await reducedTxResp.json();
    const ergoPayUrl = reducedData.url;

    if (!ergoPayUrl) {
      console.error('Unexpected response from ergopay.duckdns.org:', reducedData);
      await supabase.from('ergopay_tx_requests').delete().eq('id', requestId);
      return res.status(502).json({ error: 'Invalid response from payment service' });
    }

    return res.status(200).json({
      requestId,
      ergoPayUrl,
      amount: amountNanoerg,
      ...(tokenAmount != null && { tokenAmount }),
      ...(tokenName && { tokenName }),
    });
  } catch (err: any) {
    const msg = err?.message ?? '';
    // Surface wallet balance errors as 400 (user-actionable)
    if (msg.includes('Insufficient tokens') || msg.includes('Insufficient funds') || msg.includes('Babel fee boxes depleted')) {
      return res.status(400).json({ error: msg });
    }
    console.error('POST /api/v2/ergopay/tx/request error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: msg });
  }
}

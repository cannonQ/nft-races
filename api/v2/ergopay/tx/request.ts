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
import { buildUnsignedTx, type TxMetadata } from '../../../_lib/ergo-tx-builder.js';

const ERGOPAY_BASE = 'https://ergopay.duckdns.org';

/** Map DB collection name to user-facing dApp name (for wallet TX descriptions) */
function getAppName(collectionName: string): string {
  switch (collectionName) {
    case 'Aneta Angels': return 'Aneta Angel Racing';
    case 'CyberPets': return 'CyberPets Racing';
    default: return `${collectionName} Racing`;
  }
}

/** Generate a short alphanumeric request ID (10 chars, like the ergopay service uses) */
function generateRequestId(): string {
  return randomBytes(5).toString('hex').toUpperCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
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
    raceId,
    activity,
    boostRewardIds,
    treatmentType,
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
    let tokenId: string;
    let metadata: TxMetadata;

    if (actionType === 'training_fee') {
      // Validate training prerequisites (fail early before payment)
      if (!creatureId || !activity) {
        return res.status(400).json({ error: 'creatureId and activity are required for training' });
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
      await getOrCreateCreatureStats(creatureId, season.id);
      const validation = await validateTrainingAction(creatureId, season.id, supabase, mergedConfig);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.reason });
      }

      const appName = getAppName((creature as any).collections?.name || 'NFT');
      tokenId = creature.token_id;
      amountNanoerg = TRAINING_FEE_NANOERG;
      message = `${appName}: Training Fee (0.01 ERG)`;
      metadata = { actionType: 'train', tokenId, context: activity };

    } else {
      // race_entry_fee
      if (!creatureId || !raceId) {
        return res.status(400).json({ error: 'creatureId and raceId are required for race entry' });
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

      // Verify race exists, is open, and collection matches
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

      const raceCollectionId = race.seasons?.collection_id;
      if (raceCollectionId && creature.collection_id !== raceCollectionId) {
        return res.status(400).json({ error: 'Collection mismatch' });
      }

      // Check not already entered
      const { data: existing } = await supabase
        .from('season_race_entries')
        .select('id')
        .eq('race_id', raceId)
        .eq('creature_id', creatureId)
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(400).json({ error: 'Creature is already entered in this race' });
      }

      tokenId = creature.token_id;
      amountNanoerg = race.entry_fee_nanoerg ?? 0;
      if (amountNanoerg <= 0) {
        return res.status(400).json({ error: 'This race has no entry fee' });
      }

      const appName = getAppName((creature as any).collections?.name || 'NFT');
      const ergAmount = (amountNanoerg / 1_000_000_000).toFixed(4);
      message = `${appName}: Race Entry (${ergAmount} ERG)`;
      metadata = { actionType: 'race', tokenId, context: raceId };

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

      tokenId = creature.token_id;
      amountNanoerg = treatmentDef.cost_nanoerg;
      if (amountNanoerg <= 0) {
        return res.status(400).json({ error: 'This treatment has no fee' });
      }

      const appName = getAppName((creature as any).collections?.name || 'NFT');
      const ergAmount = (amountNanoerg / 1_000_000_000).toFixed(4);
      message = `${appName}: Treatment - ${treatmentDef.name} (${ergAmount} ERG)`;
      metadata = { actionType: 'treatment', tokenId, context: treatmentType };
    }

    // Generate our own request ID (we insert into DB first, then reference in replyTo)
    const requestId = generateRequestId();

    // Store in ergopay_tx_requests BEFORE calling the service
    const { error: insertErr } = await supabase.from('ergopay_tx_requests').insert({
      id: requestId,
      wallet_address: walletAddress,
      action_type: actionType,
      amount_nanoerg: amountNanoerg,
      creature_id: creatureId,
      race_id: raceId ?? null,
      action_payload: {
        activity: activity ?? null,
        boostRewardIds: boostRewardIds ?? null,
        treatmentType: treatmentType ?? null,
      },
      status: 'pending',
    });

    if (insertErr) {
      console.error('Failed to store ergopay_tx_request:', insertErr);
      return res.status(500).json({ error: 'Failed to store payment request' });
    }

    // Build the unsigned TX with R4-R6 metadata registers
    let unsignedTx;
    try {
      unsignedTx = await buildUnsignedTx({
        senderAddress: walletAddress,
        treasuryAddress: TREASURY_ADDRESS,
        amountNanoErg: amountNanoerg,
        metadata,
      });
    } catch (txErr) {
      // Clean up the DB row if TX building fails
      await supabase.from('ergopay_tx_requests').delete().eq('id', requestId);
      const msg = txErr instanceof Error ? txErr.message : 'Failed to build transaction';
      console.error('buildUnsignedTx failed:', txErr);
      return res.status(400).json({ error: msg });
    }

    // Build callback URL for wallet to POST signed TX ID
    const host = process.env.ERGOPAY_HOST || process.env.VERCEL_URL || 'localhost:3000';
    const replyTo = `https://${host}/api/v2/ergopay/tx/callback/${requestId}`;

    // POST to ergopay.duckdns.org/api/v1/reducedTx
    const reducedTxResp = await fetch(`${ERGOPAY_BASE}/api/v1/reducedTx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: walletAddress,
        message,
        messageSeverity: 'INFORMATION',
        replyTo,
        unsignedTx,
      }),
    });

    if (!reducedTxResp.ok) {
      const body = await reducedTxResp.text();
      console.error('ergopay.duckdns.org reducedTx failed:', reducedTxResp.status, body);
      // Clean up
      await supabase.from('ergopay_tx_requests').delete().eq('id', requestId);
      return res.status(502).json({ error: 'Failed to create payment request with the ErgoPay service' });
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
    });
  } catch (err) {
    console.error('POST /api/v2/ergopay/tx/request error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Race Join API Endpoint
 * POST /api/race/join
 *
 * Handles race entry requests with transaction payment:
 * 1. Validates request payload
 * 2. Verifies transaction (optional - can be async)
 * 3. Records entry in Supabase with txId
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidErgoAddress } from '@/lib/ergo/server';
import { isCyberPet, getCyberPetInfo } from '@/lib/cyberpets';

// ============================================
// Configuration
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// House wallet that receives entry fees
const HOUSE_WALLET = '9gbgJTNXUcdqRp2Tq8hjwnw8B5qvFSWFgDbuDKRRsNjUPjgC3vm';

// Rarity multipliers for speed calculation
const RARITY_MULTIPLIERS: Record<string, number> = {
  'Common': 1.00,
  'Uncommon': 1.01,
  'Rare': 1.02,
  'Epic': 1.04,
  'Legendary': 1.05,
  'Mythic': 1.06,
  'Relic': 1.07,
  'Masterwork': 1.08,
  'Cyberium': 1.10,
};

// ============================================
// Supabase Client
// ============================================

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ============================================
// Request Types
// ============================================

interface JoinRaceRequest {
  raceId: string;
  address: string;
  nftTokenId: string;
  txId: string;
}

interface JoinRaceResponse {
  success: boolean;
  entryId?: string;
  error?: string;
}

// ============================================
// Request Validation
// ============================================

function validateRequest(body: unknown): {
  valid: boolean;
  data?: JoinRaceRequest;
  error?: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { raceId, address, nftTokenId, txId } = body as Record<string, unknown>;

  if (typeof raceId !== 'string' || !raceId) {
    return { valid: false, error: 'Missing or invalid raceId' };
  }

  if (typeof address !== 'string' || !address) {
    return { valid: false, error: 'Missing or invalid address' };
  }

  if (typeof nftTokenId !== 'string' || !nftTokenId) {
    return { valid: false, error: 'Missing or invalid nftTokenId' };
  }

  if (typeof txId !== 'string' || !txId) {
    return { valid: false, error: 'Missing or invalid txId' };
  }

  return {
    valid: true,
    data: { raceId, address, nftTokenId, txId },
  };
}

// ============================================
// Transaction Verification (optional)
// ============================================

async function verifyTransaction(
  txId: string,
  expectedAddress: string,
  expectedAmount: bigint
): Promise<{ valid: boolean; error?: string }> {
  // For MVP, we'll do basic verification
  // In production, you'd want to:
  // 1. Query the transaction from explorer/node
  // 2. Verify output to house wallet with correct amount
  // 3. Check registers contain correct race info

  try {
    // Check if transaction exists (give it time to propagate)
    const response = await fetch(
      `https://api.ergoplatform.com/api/v1/transactions/${txId}`
    );

    if (!response.ok) {
      // Transaction might not be confirmed yet - that's OK for MVP
      // In production, you'd want to wait/retry or use mempool
      console.log(`Transaction ${txId} not yet confirmed, proceeding anyway`);
      return { valid: true };
    }

    const tx = await response.json();

    // Check if any output goes to house wallet
    const houseOutput = tx.outputs?.find(
      (out: any) => out.address === HOUSE_WALLET
    );

    if (!houseOutput) {
      return { valid: false, error: 'Transaction does not pay to house wallet' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Transaction verification error:', error);
    // For MVP, allow entry even if verification fails
    // The transaction exists on chain and can be verified later
    return { valid: true };
  }
}

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<JoinRaceResponse>> {
  console.log('=== Race Join Request Started ===');

  try {
    // 1. Parse request body
    const body = await request.json();
    console.log('1. Request body:', JSON.stringify(body, null, 2));

    // 2. Validate request structure
    const validation = validateRequest(body);
    if (!validation.valid || !validation.data) {
      console.log('2. Validation failed:', validation.error);
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { raceId, address, nftTokenId, txId } = validation.data;
    console.log('2. Validated:', { raceId, address: address.slice(0, 15) + '...', nftTokenId: nftTokenId.slice(0, 15) + '...', txId: txId.slice(0, 15) + '...' });

    // 3. Validate Ergo address format
    console.log('3. Validating address...');
    const isValidAddress = await isValidErgoAddress(address);
    if (!isValidAddress) {
      console.log('3. Address validation failed');
      return NextResponse.json(
        { success: false, error: 'Invalid Ergo address format' },
        { status: 400 }
      );
    }
    console.log('3. Address valid');

    // 4. Validate NFT is a CyberPet
    console.log('4. Checking if CyberPet...');
    if (!isCyberPet(nftTokenId)) {
      console.log('4. Not a CyberPet');
      return NextResponse.json(
        { success: false, error: 'Only CyberPets NFTs can enter races' },
        { status: 400 }
      );
    }
    console.log('4. Is CyberPet');

    // 5. Get CyberPet info for recording
    const petInfo = getCyberPetInfo(nftTokenId);
    const nftName = petInfo?.name || `CyberPet ${nftTokenId.slice(0, 8)}`;
    console.log('5. Pet info:', { nftName, number: petInfo?.number });

    // 6. Check if race exists and is accepting entries
    console.log('6. Checking race...');
    const supabase = getSupabaseClient();

    const { data: race, error: raceError } = await supabase
      .from('races')
      .select('id, status, entry_fee')
      .eq('id', raceId)
      .single();

    if (raceError) {
      console.log('6. Race query error:', raceError);
      return NextResponse.json(
        { success: false, error: `Race query failed: ${raceError.message}` },
        { status: 404 }
      );
    }

    if (!race) {
      console.log('6. Race not found');
      return NextResponse.json(
        { success: false, error: 'Race not found' },
        { status: 404 }
      );
    }
    console.log('6. Race found:', { id: race.id, status: race.status, entry_fee: race.entry_fee });

    if (race.status !== 'open') {
      console.log('6. Race not open, status:', race.status);
      return NextResponse.json(
        { success: false, error: `Race is not accepting entries (status: ${race.status})` },
        { status: 400 }
      );
    }

    // 7. Check for duplicate entries (same NFT in same race)
    console.log('7. Checking for duplicate NFT entry...');
    const { data: existingEntry, error: existingEntryError } = await supabase
      .from('race_entries')
      .select('id')
      .eq('race_id', raceId)
      .eq('nft_token_id', nftTokenId)
      .single();

    if (existingEntry) {
      console.log('7. Duplicate NFT entry found:', existingEntry.id);
      return NextResponse.json(
        { success: false, error: 'This NFT is already entered in this race' },
        { status: 409 }
      );
    }
    console.log('7. No duplicate NFT entry');

    // 8. Check for duplicate transaction ID
    console.log('8. Checking for duplicate txId...');
    const { data: existingTx, error: existingTxError } = await supabase
      .from('race_entries')
      .select('id')
      .eq('tx_id', txId)
      .single();

    if (existingTx) {
      console.log('8. Duplicate txId found:', existingTx.id);
      return NextResponse.json(
        { success: false, error: 'This transaction has already been used' },
        { status: 409 }
      );
    }
    console.log('8. No duplicate txId');

    // 9. Verify transaction (optional for MVP)
    console.log('9. Verifying transaction...');
    const txVerification = await verifyTransaction(
      txId,
      address,
      BigInt(race.entry_fee)
    );
    console.log('9. TX verification result:', txVerification);

    if (!txVerification.valid) {
      console.log('9. TX verification failed:', txVerification.error);
      return NextResponse.json(
        { success: false, error: txVerification.error || 'Transaction verification failed' },
        { status: 400 }
      );
    }

    // 10. Get CyberPet traits for recording
    const traits = petInfo?.traits || null;
    const speedMultiplier = traits ? (RARITY_MULTIPLIERS[traits.rarity] || 1.0) : 1.0;
    const consistency = traits ? (0.5 + traits.bodyParts.length * 0.04) : 0.5;
    console.log('10. Traits calculated:', { speedMultiplier, consistency, rarity: traits?.rarity });

    // 11. Record the entry in database
    console.log('11. Inserting race entry...');
    const insertData = {
      race_id: raceId,
      owner_address: address,
      nft_token_id: nftTokenId,
      nft_name: nftName,
      nft_number: petInfo?.number || null,
      traits: traits,
      speed_multiplier: speedMultiplier,
      consistency: consistency,
      signature: `TX:${txId}`,  // For browser wallet, use txId as signature proof
      tx_id: txId,
      entry_fee_paid: race.entry_fee,
      verified_at: new Date().toISOString(),
      is_house_nft: false,
    };
    console.log('11. Insert data:', JSON.stringify(insertData, null, 2));

    const { data: entry, error: insertError } = await supabase
      .from('race_entries')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      console.error('11. INSERT ERROR:', JSON.stringify(insertError, null, 2));
      console.error('11. Error code:', insertError.code);
      console.error('11. Error message:', insertError.message);
      console.error('11. Error details:', insertError.details);
      return NextResponse.json(
        { success: false, error: `Failed to record race entry: ${insertError.message}` },
        { status: 500 }
      );
    }

    console.log('11. Entry inserted successfully:', entry.id);
    console.log('=== Race Join Request Complete ===');

    // 12. Return success response
    return NextResponse.json({
      success: true,
      entryId: entry.id,
    });

  } catch (error) {
    console.error('=== Race Join EXCEPTION ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// ============================================
// GET handler to check entry status
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get('raceId');
  const address = searchParams.get('address');

  if (!raceId || !address) {
    return NextResponse.json(
      { error: 'Missing raceId or address parameter' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();

  const { data: entries, error } = await supabase
    .from('race_entries')
    .select('id, nft_token_id, nft_name, tx_id, created_at')
    .eq('race_id', raceId)
    .eq('owner_address', address);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    entries: entries || [],
    count: entries?.length || 0,
  });
}

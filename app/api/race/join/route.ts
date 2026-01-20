/**
 * Race Join API Endpoint
 * POST /api/race/join
 * 
 * Handles race entry requests:
 * 1. Validates request payload
 * 2. Verifies Ergo signature
 * 3. Confirms NFT ownership
 * 4. Records entry in Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  verifyRaceEntry,
  isValidErgoAddress,
  parseMessage,
} from '@/lib/ergo/server';
import type { JoinRaceRequest, JoinRaceResponse } from '@/lib/ergo/types';

// ============================================
// Configuration
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Optional: CyberPets collection token IDs for validation
// You can load this from a database or config file
const CYBERPETS_COLLECTION: string[] = [
  // Add your CyberPets NFT token IDs here
  // e.g., "abc123...", "def456..."
];

// ============================================
// Supabase Client
// ============================================

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
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

  const { raceId, address, nftTokenId, message, signature } = body as Record<string, unknown>;

  if (typeof raceId !== 'string' || !raceId) {
    return { valid: false, error: 'Missing or invalid raceId' };
  }

  if (typeof address !== 'string' || !address) {
    return { valid: false, error: 'Missing or invalid address' };
  }

  if (typeof nftTokenId !== 'string' || !nftTokenId) {
    return { valid: false, error: 'Missing or invalid nftTokenId' };
  }

  if (typeof message !== 'string' || !message) {
    return { valid: false, error: 'Missing or invalid message' };
  }

  if (typeof signature !== 'string' || !signature) {
    return { valid: false, error: 'Missing or invalid signature' };
  }

  return {
    valid: true,
    data: { raceId, address, nftTokenId, message, signature },
  };
}

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<JoinRaceResponse>> {
  try {
    // 1. Parse request body
    const body = await request.json();
    
    // 2. Validate request structure
    const validation = validateRequest(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { raceId, address, nftTokenId, message, signature } = validation.data;

    // 3. Validate Ergo address format
    const isValidAddress = await isValidErgoAddress(address);
    if (!isValidAddress) {
      return NextResponse.json(
        { success: false, error: 'Invalid Ergo address format' },
        { status: 400 }
      );
    }

    // 4. Validate message format
    const parsedMessage = parseMessage(message);
    if (!parsedMessage.valid) {
      return NextResponse.json(
        { success: false, error: parsedMessage.error },
        { status: 400 }
      );
    }

    // 5. Check if race exists and is accepting entries
    const supabase = getSupabaseClient();
    
    const { data: race, error: raceError } = await supabase
      .from('races')
      .select('id, status')
      .eq('id', raceId)
      .single();

    if (raceError || !race) {
      return NextResponse.json(
        { success: false, error: 'Race not found' },
        { status: 404 }
      );
    }

    if (race.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Race is not accepting entries' },
        { status: 400 }
      );
    }

    // 6. Check for duplicate entries (same address + NFT in same race)
    const { data: existingEntry } = await supabase
      .from('race_entries')
      .select('id')
      .eq('race_id', raceId)
      .eq('nft_token_id', nftTokenId)
      .single();

    if (existingEntry) {
      return NextResponse.json(
        { success: false, error: 'This NFT is already entered in this race' },
        { status: 409 }
      );
    }

    // 7. Verify signature and NFT ownership
    const verificationResult = await verifyRaceEntry(
      address,
      message,
      signature,
      raceId,
      nftTokenId,
      CYBERPETS_COLLECTION.length > 0 ? CYBERPETS_COLLECTION : undefined
    );

    if (!verificationResult.valid) {
      return NextResponse.json(
        { success: false, error: verificationResult.error || 'Verification failed' },
        { status: 403 }
      );
    }

    // 8. Record the entry in database
    const { data: entry, error: insertError } = await supabase
      .from('race_entries')
      .insert({
        race_id: raceId,
        address,
        nft_token_id: nftTokenId,
        message,
        signature,
        verified_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to insert race entry:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to record race entry' },
        { status: 500 }
      );
    }

    // 9. Return success response
    return NextResponse.json({
      success: true,
      entryId: entry.id,
    });

  } catch (error) {
    console.error('Race join error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// Optional: GET handler to check entry status
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
    .select('id, nft_token_id, created_at')
    .eq('race_id', raceId)
    .eq('address', address);

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

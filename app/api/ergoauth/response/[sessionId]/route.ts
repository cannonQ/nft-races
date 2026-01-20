/**
 * POST /api/ergoauth/response/[sessionId]
 * Wallet posts the signed response after user approves
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getErgoAuthSession,
  setErgoAuthResponse,
  verifyErgoAuthResponse,
  type ErgoAuthResponse,
} from '@/lib/ergo/ergoauth';
import { verifyNFTOwnership } from '@/lib/ergo/server';
import { getCyberPetInfo } from '@/lib/cyberpets';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

function getHostname(request: NextRequest): string {
  return request.headers.get('host')?.split(':')[0] || 'localhost';
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const session = getErgoAuthSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'pending') {
      return NextResponse.json(
        { error: `Session is ${session.status}` },
        { status: 400 }
      );
    }

    // Parse the ErgoAuthResponse from wallet
    const body = await request.json() as ErgoAuthResponse;
    
    if (!body.signedMessage || !body.proof) {
      return NextResponse.json(
        { error: 'Invalid response: missing signedMessage or proof' },
        { status: 400 }
      );
    }

    // Store the response
    setErgoAuthResponse(sessionId, body);

    // Verify the signature
    const hostname = getHostname(request);
    const verification = await verifyErgoAuthResponse(session, body, hostname);

    if (!verification.isValid) {
      return NextResponse.json(
        { error: verification.error || 'Signature verification failed' },
        { status: 403 }
      );
    }

    // Verify NFT ownership
    const ownership = await verifyNFTOwnership(session.address, session.nftTokenId);
    if (!ownership.ownsToken) {
      return NextResponse.json(
        { error: 'Address does not own the specified NFT' },
        { status: 403 }
      );
    }

    // All verification passed - create the race entry
    const supabase = getSupabaseClient();

    // Get CyberPet info for recording
    const petInfo = getCyberPetInfo(session.nftTokenId);
    const nftName = petInfo?.name || `CyberPet ${session.nftTokenId.slice(0, 8)}`;
    const traits = petInfo?.traits || null;
    const speedMultiplier = traits ? (RARITY_MULTIPLIERS[traits.rarity] || 1.0) : 1.0;
    const consistency = traits ? (0.5 + traits.bodyParts.length * 0.04) : 0.5;

    const { data: entry, error: insertError } = await supabase
      .from('race_entries')
      .insert({
        race_id: session.raceId,
        owner_address: session.address,
        nft_token_id: session.nftTokenId,
        nft_name: nftName,
        nft_number: petInfo?.number || null,
        traits: traits,
        speed_multiplier: speedMultiplier,
        consistency: consistency,
        signature: body.proof,
        verified_at: new Date().toISOString(),
        is_house_nft: false,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to insert race entry:', insertError);
      return NextResponse.json(
        { error: 'Failed to record race entry' },
        { status: 500 }
      );
    }

    // Success! Wallet can close
    return NextResponse.json({
      success: true,
      entryId: entry.id,
      message: 'Successfully entered the race!',
    });

  } catch (error) {
    console.error('ErgoAuth response processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process authentication response' },
      { status: 500 }
    );
  }
}

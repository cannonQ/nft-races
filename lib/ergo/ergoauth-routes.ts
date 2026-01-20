/**
 * ErgoAuth API Routes
 * 
 * These endpoints handle the ErgoAuth (EIP-28) flow for mobile wallet authentication.
 * 
 * Flow:
 * 1. POST /api/ergoauth/session - Create new auth session, returns QR code URL
 * 2. GET /api/ergoauth/request/[sessionId] - Wallet fetches the signing request
 * 3. POST /api/ergoauth/response/[sessionId] - Wallet posts signed response
 * 4. GET /api/ergoauth/status/[sessionId] - Frontend polls for completion
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createErgoAuthSession,
  getErgoAuthSession,
  setErgoAuthResponse,
  verifyErgoAuthResponse,
  type ErgoAuthRequest,
  type ErgoAuthResponse,
} from '@/lib/ergo/ergoauth';
import { verifyNFTOwnership } from '@/lib/ergo/server';
import { createClient } from '@supabase/supabase-js';

// ============================================
// Configuration
// ============================================

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

function getBaseUrl(request: NextRequest): string {
  // In production, use your actual domain
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

function getHostname(request: NextRequest): string {
  return request.headers.get('host')?.split(':')[0] || 'localhost';
}

// ============================================
// POST /api/ergoauth/session
// Create a new ErgoAuth session for race entry
// ============================================

export async function POST_session(request: NextRequest) {
  try {
    const body = await request.json();
    const { raceId, nftTokenId, address } = body;

    // Validate inputs
    if (!raceId || !nftTokenId || !address) {
      return NextResponse.json(
        { error: 'Missing required fields: raceId, nftTokenId, address' },
        { status: 400 }
      );
    }

    // Check race exists and is accepting entries
    const supabase = getSupabaseClient();
    const { data: race, error: raceError } = await supabase
      .from('races')
      .select('id, status')
      .eq('id', raceId)
      .single();

    if (raceError || !race) {
      return NextResponse.json(
        { error: 'Race not found' },
        { status: 404 }
      );
    }

    if (race.status !== 'open') {
      return NextResponse.json(
        { error: 'Race is not accepting entries' },
        { status: 400 }
      );
    }

    // Check for existing entry
    const { data: existingEntry } = await supabase
      .from('race_entries')
      .select('id')
      .eq('race_id', raceId)
      .eq('nft_token_id', nftTokenId)
      .single();

    if (existingEntry) {
      return NextResponse.json(
        { error: 'This NFT is already entered in this race' },
        { status: 409 }
      );
    }

    // Create ErgoAuth session
    const baseUrl = getBaseUrl(request);
    const session = await createErgoAuthSession(raceId, nftTokenId, address, baseUrl);

    return NextResponse.json({
      sessionId: session.sessionId,
      qrCodeUrl: session.qrCodeUrl,     // Display this as QR code
      ergoAuthUrl: session.ergoAuthUrl, // Clickable link for mobile
      expiresIn: 300,                   // 5 minutes in seconds
    });

  } catch (error) {
    console.error('ErgoAuth session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create authentication session' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/ergoauth/request/[sessionId]
// Wallet fetches the ErgoAuthRequest
// ============================================

export async function GET_request(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const session = getErgoAuthSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { userMessage: 'Session not found. Please try again.' },
        { status: 404 }
      );
    }

    if (session.status === 'expired') {
      return NextResponse.json(
        { userMessage: 'Session expired. Please start over.' },
        { status: 410 }
      );
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { userMessage: 'Session already completed.' },
        { status: 409 }
      );
    }

    // Build the ErgoAuthRequest response
    const baseUrl = getBaseUrl(request);
    const ergoAuthRequest: ErgoAuthRequest = {
      signingMessage: session.signingMessage,
      sigmaBoolean: Buffer.from(session.address).toString('base64'),
      userMessage: `Join CyberPets Race\n\nRace ID: ${session.raceId}\nYour NFT: ${session.nftTokenId.slice(0, 12)}...`,
      messageSeverity: 'INFORMATION',
      replyToUrl: `${baseUrl}/api/ergoauth/response/${sessionId}`,
    };

    return NextResponse.json(ergoAuthRequest);

  } catch (error) {
    console.error('ErgoAuth request fetch error:', error);
    return NextResponse.json(
      { userMessage: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/ergoauth/response/[sessionId]
// Wallet posts the signed response
// ============================================

export async function POST_response(
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
    
    const { data: entry, error: insertError } = await supabase
      .from('race_entries')
      .insert({
        race_id: session.raceId,
        address: session.address,
        nft_token_id: session.nftTokenId,
        message: body.signedMessage,
        signature: body.proof,
        verified_at: new Date().toISOString(),
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

// ============================================
// GET /api/ergoauth/status/[sessionId]
// Frontend polls for completion status
// ============================================

export async function GET_status(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const session = getErgoAuthSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { status: 'not_found' },
        { status: 404 }
      );
    }

    // If completed, also return the entry ID
    if (session.status === 'completed') {
      const supabase = getSupabaseClient();
      const { data: entry } = await supabase
        .from('race_entries')
        .select('id')
        .eq('race_id', session.raceId)
        .eq('nft_token_id', session.nftTokenId)
        .single();

      return NextResponse.json({
        status: 'completed',
        entryId: entry?.id,
      });
    }

    return NextResponse.json({
      status: session.status,
      expiresAt: session.expiresAt,
    });

  } catch (error) {
    console.error('ErgoAuth status check error:', error);
    return NextResponse.json(
      { status: 'error' },
      { status: 500 }
    );
  }
}

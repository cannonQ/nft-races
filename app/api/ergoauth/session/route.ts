/**
 * POST /api/ergoauth/session
 * Create a new ErgoAuth session for mobile wallet authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createErgoAuthSession,
  addressToSigmaBoolean,
} from '@/lib/ergo/ergoauth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export async function POST(request: NextRequest) {
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

    if (race.status !== 'pending') {
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
      qrCodeUrl: session.qrCodeUrl,
      ergoAuthUrl: session.ergoAuthUrl,
      expiresIn: 300,
    });

  } catch (error) {
    console.error('ErgoAuth session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create authentication session' },
      { status: 500 }
    );
  }
}

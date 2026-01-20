/**
 * GET /api/ergoauth/status/[sessionId]
 * Frontend polls this endpoint to check if wallet has completed signing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getErgoAuthSession } from '@/lib/ergo/ergoauth';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(
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

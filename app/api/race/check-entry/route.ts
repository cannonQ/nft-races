/**
 * GET /api/race/check-entry
 * Pre-check if an NFT can enter a race (before signing transaction)
 *
 * Query params:
 * - raceId: Race to enter
 * - nftTokenId: NFT to check
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raceId = searchParams.get('raceId');
  const nftTokenId = searchParams.get('nftTokenId');

  if (!raceId || !nftTokenId) {
    return NextResponse.json(
      { canEnter: false, error: 'Missing raceId or nftTokenId' },
      { status: 400 }
    );
  }

  try {
    // Check if race exists and is open
    const { data: race, error: raceError } = await supabase
      .from('races')
      .select('id, status, max_entries')
      .eq('id', raceId)
      .single();

    if (raceError || !race) {
      return NextResponse.json({
        canEnter: false,
        error: 'Race not found',
      });
    }

    if (race.status !== 'open') {
      return NextResponse.json({
        canEnter: false,
        error: `Race is not accepting entries (status: ${race.status})`,
      });
    }

    // Check if NFT is already entered
    const { data: existingEntry } = await supabase
      .from('race_entries')
      .select('id')
      .eq('race_id', raceId)
      .eq('nft_token_id', nftTokenId)
      .single();

    if (existingEntry) {
      return NextResponse.json({
        canEnter: false,
        error: 'This NFT is already entered in this race',
      });
    }

    // Check if race is full
    const { count } = await supabase
      .from('race_entries')
      .select('*', { count: 'exact', head: true })
      .eq('race_id', raceId);

    if (count && count >= race.max_entries) {
      return NextResponse.json({
        canEnter: false,
        error: 'Race is full',
      });
    }

    return NextResponse.json({
      canEnter: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { canEnter: false, error: err.message },
      { status: 500 }
    );
  }
}

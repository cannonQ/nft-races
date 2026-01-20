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

    // Check if race has room (either empty slots or house NFTs to replace)
    const { count: totalEntries } = await supabase
      .from('race_entries')
      .select('*', { count: 'exact', head: true })
      .eq('race_id', raceId);

    const { count: houseEntries } = await supabase
      .from('race_entries')
      .select('*', { count: 'exact', head: true })
      .eq('race_id', raceId)
      .eq('is_house_nft', true);

    // Race is truly full only if all slots are taken by real players (no house NFTs to replace)
    const realEntries = (totalEntries || 0) - (houseEntries || 0);
    if (realEntries >= race.max_entries) {
      return NextResponse.json({
        canEnter: false,
        error: 'Race is full (all slots taken by real players)',
      });
    }

    // Also check if total is at max AND no house NFTs (shouldn't happen, but safety check)
    if (totalEntries && totalEntries >= race.max_entries && (!houseEntries || houseEntries === 0)) {
      return NextResponse.json({
        canEnter: false,
        error: 'Race is full',
      });
    }

    return NextResponse.json({
      canEnter: true,
      spotsAvailable: race.max_entries - realEntries,
      houseNftsToReplace: houseEntries || 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { canEnter: false, error: err.message },
      { status: 500 }
    );
  }
}

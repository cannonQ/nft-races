import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Payout percentages
const PAYOUTS = [
  { position: 1, percentage: 0.50 },
  { position: 2, percentage: 0.30 },
  { position: 3, percentage: 0.15 },
  // House keeps 5%
];

// POST /api/admin/races/[id]/resolve - Resolve race and determine results
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get race
    const { data: race, error: raceError } = await supabase
      .from('races')
      .select('*')
      .eq('id', params.id)
      .single();

    if (raceError || !race) {
      return NextResponse.json({ error: 'Race not found' }, { status: 404 });
    }

    if (race.status !== 'closed') {
      return NextResponse.json({ error: 'Race must be closed first' }, { status: 400 });
    }

    // Get entries
    const { data: entries, error: entriesError } = await supabase
      .from('race_entries')
      .select('*')
      .eq('race_id', params.id)
      .order('created_at', { ascending: true });

    if (entriesError) throw entriesError;

    if (!entries || entries.length < race.min_entries) {
      return NextResponse.json({ error: 'Not enough entries' }, { status: 400 });
    }

    // Generate combined seed from server seed + all signatures
    const signatures = entries.map(e => e.signature).sort().join('');
    const combinedSeed = createHash('sha256')
      .update(race.server_seed + signatures)
      .digest('hex');

    // Simulate race using combined seed
    const results = simulateRace(entries, combinedSeed);

    // Calculate prize pool
    const totalPool = entries.length * race.entry_fee;
    const prizePool = totalPool * 0.95; // 5% house fee

    // Update entries with results
    for (const result of results) {
      const payout = PAYOUTS.find(p => p.position === result.position);
      const payoutAmount = payout ? Math.floor(prizePool * payout.percentage) : 0;

      await supabase
        .from('race_entries')
        .update({
          final_position: result.position,
          final_distance: result.distance,
          payout_amount: payoutAmount,
        })
        .eq('id', result.entryId);
    }

    // Update race status and reveal seed
    await supabase
      .from('races')
      .update({
        status: 'resolved',
        combined_seed: combinedSeed,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    return NextResponse.json({ 
      success: true, 
      results,
      combinedSeed,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Simple seeded RNG
function seededRandom(seed: string, index: number): number {
  const hash = createHash('sha256').update(seed + index.toString()).digest('hex');
  return parseInt(hash.slice(0, 8), 16) / 0xffffffff;
}

// Simulate race
function simulateRace(entries: any[], seed: string) {
  const results = entries.map((entry, i) => {
    // 10 segments per race
    let totalDistance = 0;
    
    for (let seg = 0; seg < 10; seg++) {
      const rngIndex = i * 100 + seg;
      const roll = seededRandom(seed, rngIndex) * 100;
      
      // Use traits if available
      const traits = entry.traits || {};
      const speedMult = traits.speedMultiplier || 1.0;
      const consistency = traits.consistency || 0.6;
      
      const variance = (1 - consistency) * 40;
      const swing = (seededRandom(seed, rngIndex + 50) - 0.5) * variance;
      
      totalDistance += (roll + swing) * speedMult;
    }

    return {
      entryId: entry.id,
      nftTokenId: entry.nft_token_id,
      nftName: entry.nft_name,
      distance: totalDistance,
      position: 0,
    };
  });

  // Sort by distance (highest wins)
  results.sort((a, b) => b.distance - a.distance);

  // Assign positions
  results.forEach((r, i) => {
    r.position = i + 1;
  });

  return results;
}

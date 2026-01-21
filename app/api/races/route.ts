import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET /api/races - List races (open and resolved)
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    // Get open races
    const { data: openRaces, error: openError } = await supabase
      .from('races')
      .select('*')
      .in('status', ['open', 'pending', 'closed'])
      .order('created_at', { ascending: false });

    if (openError) throw openError;

    // Get resolved races (limit to recent 10)
    const { data: resolvedRaces, error: resolvedError } = await supabase
      .from('races')
      .select('*')
      .eq('status', 'resolved')
      .order('resolved_at', { ascending: false })
      .limit(10);

    if (resolvedError) throw resolvedError;

    // Get entry counts for open races
    const openWithCount = await Promise.all(
      (openRaces || []).map(async (race) => {
        const { count } = await supabase
          .from('race_entries')
          .select('*', { count: 'exact', head: true })
          .eq('race_id', race.id);

        return {
          ...race,
          entry_count: count || 0,
        };
      })
    );

    // Get entry counts and winner for resolved races
    const resolvedWithDetails = await Promise.all(
      (resolvedRaces || []).map(async (race) => {
        const { count } = await supabase
          .from('race_entries')
          .select('*', { count: 'exact', head: true })
          .eq('race_id', race.id);

        // Get winner
        const { data: winner } = await supabase
          .from('race_entries')
          .select('nft_name, nft_number, owner_address')
          .eq('race_id', race.id)
          .eq('final_position', 1)
          .single();

        return {
          ...race,
          entry_count: count || 0,
          winner: winner || null,
        };
      })
    );

    return NextResponse.json({
      races: openWithCount,
      resolvedRaces: resolvedWithDetails,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

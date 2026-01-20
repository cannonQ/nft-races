import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET /api/races - List open races
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    // Get races
    const { data: races, error } = await supabase
      .from('races')
      .select('*')
      .in('status', ['open', 'pending'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get entry counts for each race
    const racesWithCount = await Promise.all(
      (races || []).map(async (race) => {
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

    return NextResponse.json({ races: racesWithCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

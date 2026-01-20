import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/races - List open races
export async function GET() {
  try {
    const { data: races, error } = await supabase
      .from('races')
      .select('*, race_entries(count)')
      .in('status', ['open', 'pending'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add entry count
    const racesWithCount = races?.map(race => ({
      ...race,
      entry_count: race.race_entries?.[0]?.count || 0,
    }));

    return NextResponse.json({ races: racesWithCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

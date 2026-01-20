import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/races/[id]/entries - Get race entries
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raceId } = await context.params;
    console.log('Fetching entries for race:', raceId);

    const { data: entries, error } = await supabase
      .from('race_entries')
      .select('*')
      .eq('race_id', raceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Entries query error:', error);
      throw error;
    }

    console.log(`Found ${entries?.length || 0} entries for race ${raceId}`);
    return NextResponse.json({ entries: entries || [] });
  } catch (err: any) {
    console.error('Entries API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

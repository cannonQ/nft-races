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
    console.log('=== Entries API Debug ===');
    console.log('Race ID:', raceId);
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + '...');
    console.log('Service key exists:', !!process.env.SUPABASE_SERVICE_KEY);

    // First try to count all entries to verify table access
    const { count, error: countError } = await supabase
      .from('race_entries')
      .select('*', { count: 'exact', head: true });

    console.log('Total entries in table:', count);
    if (countError) console.error('Count error:', countError);

    // Now query for this race
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
    if (entries && entries.length > 0) {
      console.log('First entry:', JSON.stringify(entries[0], null, 2));
    }

    return NextResponse.json({ entries: entries || [] });
  } catch (err: any) {
    console.error('Entries API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/admin/races - List all races
export async function GET() {
  try {
    const { data: races, error } = await supabase
      .from('races')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ races: races || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/admin/races - Create new race
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, entry_fee, max_entries, min_entries, entry_deadline } = body;

    // Generate server seed and hash
    const serverSeed = randomBytes(32).toString('hex');
    const serverSeedHash = createHash('sha256').update(serverSeed).digest('hex');

    const { data: race, error } = await supabase
      .from('races')
      .insert({
        name,
        entry_fee,
        max_entries,
        min_entries: min_entries || 2,
        entry_deadline,
        server_seed: serverSeed,
        server_seed_hash: serverSeedHash,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Don't expose server_seed in response
    const { server_seed, ...safeRace } = race;

    return NextResponse.json({ race: safeRace });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

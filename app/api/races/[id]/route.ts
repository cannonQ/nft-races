import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// GET /api/races/[id] - Get race details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: race, error } = await supabase
      .from('races')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!race) {
      return NextResponse.json({ error: 'Race not found' }, { status: 404 });
    }

    return NextResponse.json({ race });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

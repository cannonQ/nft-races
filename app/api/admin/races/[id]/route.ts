import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// PATCH /api/admin/races/[id] - Update race status
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raceId } = await context.params;
    const body = await request.json();
    const { status } = body;

    if (!['pending', 'open', 'closed', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { data: race, error } = await supabase
      .from('races')
      .update({ status })
      .eq('id', raceId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ race });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

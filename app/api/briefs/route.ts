// GET /api/briefs  — list user's recent briefs (last 20)
// POST /api/briefs — save a completed brief

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('briefs')
    .select('id, prospect, call_type, created_at, cards')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ briefs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { prospect, callType, notes, cards } = body;

  if (!prospect || !callType || !cards) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('briefs')
    .insert({
      user_id: userId,
      prospect,
      call_type: callType,
      notes: notes ?? '',
      cards,
    })
    .select('id')
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ id: data.id });
}

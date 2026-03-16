// GET /api/profile  — fetch signed-in user's SE profile
// POST /api/profile — upsert signed-in user's SE profile

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('se_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ profile: data ?? null });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, company, product, whatItDoes, strengths, weaknesses, typicalBuyer } = body;

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('se_profiles')
    .upsert({
      user_id: userId,
      name: name ?? '',
      company: company ?? '',
      product: product ?? '',
      what_it_does: whatItDoes ?? '',
      strengths: strengths ?? '',
      weaknesses: weaknesses ?? '',
      typical_buyer: typicalBuyer ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ profile: data });
}

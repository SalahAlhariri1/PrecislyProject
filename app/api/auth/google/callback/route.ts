// GET /api/auth/google/callback — handle Google OAuth redirect, store tokens

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
import { exchangeCode } from '@/lib/google';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state'); // userId passed as OAuth state
  const error = searchParams.get('error');

  if (error || !code || !userId) {
    redirect('/?calendar=error');
  }

  try {
    const tokens = await exchangeCode(code!);

    const supabase = createSupabaseAdmin();
    await supabase.from('calendar_tokens').upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? '',
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch (err) {
    console.error('[google/callback]', err);
    redirect('/?calendar=error');
  }

  redirect('/?calendar=connected');
}

// GET /api/auth/google/connect — redirect user to Google OAuth consent screen

export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getOAuthUrl } from '@/lib/google';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const url = getOAuthUrl(userId);
  redirect(url);
}

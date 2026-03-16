// GET /api/calendar/meetings
// Fetches upcoming calendar events from Google, syncs them into meeting_triggers,
// and returns the full list with brief status for the sidebar.

export const runtime = 'nodejs';

import { auth } from '@clerk/nextjs/server';
import { getValidAccessToken, getUpcomingEvents, extractCompanyName } from '@/lib/google';
import { createSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return Response.json({ connected: false, meetings: [] });
  }

  const supabase = createSupabaseAdmin();

  // Fetch fresh events from Google and upsert into meeting_triggers
  try {
    const events = await getUpcomingEvents(accessToken);

    for (const event of events) {
      const companyName = extractCompanyName(event);
      if (!companyName) continue;

      const meetingTime = event.start.dateTime ?? event.start.date;
      if (!meetingTime) continue;

      await supabase.from('meeting_triggers').upsert({
        user_id: userId,
        calendar_event_id: event.id,
        company_name: companyName,
        meeting_time: meetingTime,
        call_type: 'discovery',
        status: 'pending',
      }, {
        onConflict: 'user_id,calendar_event_id',
        ignoreDuplicates: true, // don't overwrite status/brief_id on existing rows
      });
    }
  } catch (err) {
    console.error('[calendar/meetings] Google fetch error:', err);
    // Non-fatal — still return what we have in DB
  }

  // Return all upcoming triggers for this user (with brief cards if complete)
  const now = new Date().toISOString();
  const weekOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: meetings } = await supabase
    .from('meeting_triggers')
    .select(`
      id,
      calendar_event_id,
      company_name,
      call_type,
      meeting_time,
      status,
      brief_id,
      briefs (cards)
    `)
    .eq('user_id', userId)
    .gte('meeting_time', now)
    .lte('meeting_time', weekOut)
    .order('meeting_time', { ascending: true });

  return Response.json({ connected: true, meetings: meetings ?? [] });
}

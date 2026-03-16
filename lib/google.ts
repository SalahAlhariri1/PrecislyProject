// Google OAuth 2.0 + Calendar API helpers

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; self?: boolean }[];
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

// ─── OAuth ───────────────────────────────────────────────

export function getOAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Failed to refresh Google token');
  return res.json();
}

// Returns a valid access token (refreshing if needed), or null if not connected.
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { createSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = createSupabaseAdmin();

  const { data } = await supabase
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) return null;

  // Refresh if expiring within 5 minutes
  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      const { access_token, expires_in } = await refreshAccessToken(data.refresh_token);
      await supabase
        .from('calendar_tokens')
        .update({
          access_token,
          expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      return access_token;
    } catch {
      return null;
    }
  }

  return data.access_token;
}

// ─── Calendar ────────────────────────────────────────────

export async function getUpcomingEvents(accessToken: string, days = 7): Promise<CalendarEvent[]> {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '30',
  });

  const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Failed to fetch Google Calendar events');
  const data = await res.json();
  return data.items ?? [];
}

// Extract a company name from a calendar event.
// Tries external attendee email domains first, then the meeting title.
export function extractCompanyName(event: CalendarEvent): string | null {
  // From attendee emails: filter out self + gmail.com
  if (event.attendees && event.attendees.length > 0) {
    const external = event.attendees.filter(
      a => !a.self && a.email && !a.email.endsWith('gmail.com')
    );
    if (external.length > 0) {
      const domain = external[0].email.split('@')[1] ?? '';
      // Take the second-level domain (e.g., salesforce.com → Salesforce)
      const sld = domain.split('.').slice(-2)[0];
      if (sld) return sld.charAt(0).toUpperCase() + sld.slice(1);
    }
  }

  // From title patterns: "Discovery - Salesforce", "Call with Acme", "Salesforce Demo"
  const title = event.summary ?? '';
  const patterns = [
    /(?:with|@)\s+([A-Z][a-zA-Z0-9 ]+?)(?:\s*[-|,]|$)/,
    /^([A-Z][a-zA-Z0-9 ]+?)\s+(?:call|meeting|demo|sync|discovery|review|debrief)/i,
    /(?:call|meeting|demo|sync|discovery|review|debrief)\s+(?:with\s+)?([A-Z][a-zA-Z0-9 ]+)/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

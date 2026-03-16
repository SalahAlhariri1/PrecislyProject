// POST /api/calendar/trigger — cron endpoint
// Finds pending meeting_triggers starting within 2 hours and auto-generates briefs.
// Called by Vercel Cron. Secured by CRON_SECRET header.

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { runAgentLoop } from '@/lib/agent';

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const now = new Date();
  const twoHoursOut = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Find pending meetings starting within the next 2 hours
  const { data: pending } = await supabase
    .from('meeting_triggers')
    .select('*')
    .eq('status', 'pending')
    .gte('meeting_time', now.toISOString())
    .lte('meeting_time', twoHoursOut.toISOString());

  if (!pending || pending.length === 0) {
    return Response.json({ triggered: 0 });
  }

  let triggered = 0;

  for (const trigger of pending) {
    // Mark as running
    await supabase
      .from('meeting_triggers')
      .update({ status: 'running' })
      .eq('id', trigger.id);

    try {
      // Look up the user's SE profile
      const { data: seData } = await supabase
        .from('se_profiles')
        .select('*')
        .eq('user_id', trigger.user_id)
        .single();

      const seProfile = seData ? {
        name: seData.name ?? '',
        company: seData.company ?? '',
        product: seData.product ?? '',
        whatItDoes: seData.what_it_does ?? '',
        strengths: seData.strengths ?? '',
        weaknesses: seData.weaknesses ?? '',
        typicalBuyer: seData.typical_buyer ?? '',
      } : {
        name: '', company: '', product: '', whatItDoes: '',
        strengths: '', weaknesses: '', typicalBuyer: '',
      };

      // Run the agent, collecting card_ready events
      const cards: Record<string, unknown> = {};

      await runAgentLoop(
        {
          prospect: trigger.company_name,
          callType: trigger.call_type ?? 'discovery',
          seProfile,
          notes: '',
        },
        (event) => {
          if (event.type === 'card_ready') {
            const { type, data } = event.data as { type: string; data: unknown };
            cards[type] = data;
          }
        }
      );

      // Save brief
      const { data: brief } = await supabase
        .from('briefs')
        .insert({
          user_id: trigger.user_id,
          prospect: trigger.company_name,
          call_type: trigger.call_type ?? 'discovery',
          notes: '',
          cards,
        })
        .select('id')
        .single();

      // Update trigger
      await supabase
        .from('meeting_triggers')
        .update({ status: 'complete', brief_id: brief?.id ?? null })
        .eq('id', trigger.id);

      triggered++;
    } catch (err) {
      console.error(`[calendar/trigger] Failed for trigger ${trigger.id}:`, err);
      await supabase
        .from('meeting_triggers')
        .update({ status: 'failed' })
        .eq('id', trigger.id);
    }
  }

  return Response.json({ triggered });
}

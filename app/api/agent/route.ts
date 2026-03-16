// POST /api/agent — SSE streaming wrapper around the core agent loop

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { runAgentLoop, type AgentParams } from '@/lib/agent';

export async function POST(req: NextRequest) {
  const body: AgentParams = await req.json();

  if (!body.prospect) {
    return new Response(JSON.stringify({ error: 'Prospect company is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      }

      try {
        await runAgentLoop(body, (event) => send(event.type, event.data));
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : 'Agent encountered an error.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

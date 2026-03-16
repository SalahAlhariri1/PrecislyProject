// POST /api/agent — SSE agentic loop with progressive card streaming
// Each output_* tool fires a card_ready event immediately as the agent completes that section.
// Research tools run in parallel within each agent response.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStockData } from '@/lib/alphaVantage';
import { getCompanyNews } from '@/lib/newsApi';

// ─── Types ──────────────────────────────────────────────

interface AgentBody {
  prospect: string;
  callType: 'discovery' | 'demo' | 'rfp';
  seProfile: {
    name: string;
    company: string;
    product: string;
    whatItDoes: string;
    strengths: string;
    weaknesses: string;
    typicalBuyer: string;
  };
  notes: string;
}

// ─── Research tools ──────────────────────────────────────

const RESEARCH_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_web',
    description:
      'Search the web for any query. Use this to find recent news, company announcements, funding rounds, layoffs, product launches, pricing, or any current information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_url',
    description:
      'Fetch and read the full content of a specific URL. Use when a search result looks highly relevant and you need the full article or page.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'search_jobs',
    description:
      'Search for open job postings at a company. Job postings reveal internal pain points, tech stack, growth areas, and strategic priorities better than any press release.',
    input_schema: {
      type: 'object' as const,
      properties: {
        company: { type: 'string', description: 'Company name' },
        role_type: {
          type: 'string',
          description: 'Optional role type filter e.g. "engineering" or "sales"',
        },
      },
      required: ['company'],
    },
  },
  {
    name: 'get_stock_data',
    description: 'Get current stock price and recent performance for a public company.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string', description: 'Stock ticker symbol e.g. AAPL' },
      },
      required: ['ticker'],
    },
  },
  {
    name: 'get_news',
    description: 'Get recent news headlines for a company from NewsAPI.',
    input_schema: {
      type: 'object' as const,
      properties: {
        company: { type: 'string', description: 'Company name' },
      },
      required: ['company'],
    },
  },
];

// ─── Output tools (fire card_ready events) ──────────────

const OUTPUT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'output_snapshot',
    description:
      'Output the company snapshot card. Call this as soon as you have basic company context — do NOT wait for all research to complete. This card appears in the UI immediately.',
    input_schema: {
      type: 'object' as const,
      properties: {
        snapshot: {
          type: 'object',
          properties: {
            revenue: { type: 'string', description: 'Annual revenue e.g. "$383B (FY2024)"' },
            marketCap: { type: 'string', description: 'Market cap e.g. "$3.68T"' },
            growth: { type: 'string', description: 'YoY growth e.g. "+12%"' },
            ceo: { type: 'string', description: 'CEO name' },
            founded: { type: 'string', description: 'Year founded' },
            employees: { type: 'string', description: 'Approx headcount e.g. "~182,000"' },
            description: { type: 'string', description: 'One-sentence company description' },
          },
          required: ['revenue', 'marketCap', 'growth', 'ceo', 'founded', 'employees', 'description'],
        },
        techStack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Inferred tech stack from job postings and public info',
        },
        stockSymbol: { type: 'string', description: 'Ticker symbol if public, omit if private' },
        stockIsPublic: { type: 'boolean' },
      },
      required: ['snapshot', 'techStack'],
    },
  },
  {
    name: 'output_intelligence',
    description:
      'Output pain signals, job insights, and competitive context. Call this once you have identified the key pain points — appears immediately. You can still research more after calling this.',
    input_schema: {
      type: 'object' as const,
      properties: {
        painSignals: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Each must be specific and evidence-backed from your research. No generic observations.',
        },
        jobPostingInsights: {
          type: 'array',
          items: { type: 'string' },
          description: 'What do hiring patterns reveal about strategic direction?',
        },
        recentDevelopments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recent news, funding, product launches, leadership changes',
        },
        redFlags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Deal risks: layoffs, legal issues, churn signals, financial stress',
        },
        competitiveLandscape: {
          type: 'string',
          description: 'What vendors are they likely using today? Who else is competing for this deal?',
        },
      },
      required: ['painSignals', 'recentDevelopments', 'competitiveLandscape'],
    },
  },
  {
    name: 'output_call_prep',
    description:
      'Output the call-specific prep package: opening line, agenda/demo script/RFP answers, and objection handling. Call this when synthesis is ready — appears immediately.',
    input_schema: {
      type: 'object' as const,
      properties: {
        openingLine: {
          type: 'string',
          description:
            'One specific sentence to open the call. Must reference a real, recent event you found. This should show you\'ve done your homework.',
        },
        agenda: {
          type: 'array',
          description: 'For discovery calls — 5 items',
          items: {
            type: 'object',
            properties: {
              item: { type: 'string' },
              question: { type: 'string' },
              why: { type: 'string', description: 'Why this matters for your product' },
            },
            required: ['item', 'question', 'why'],
          },
        },
        demoScript: {
          type: 'array',
          description: 'For demo calls — 5 acts: Hook → Problem → Solution → Proof → CTA',
          items: {
            type: 'object',
            properties: {
              act: { type: 'string' },
              whatToShow: { type: 'string' },
              whatToSay: { type: 'string' },
              addresses: { type: 'string', description: 'Which pain signal this addresses' },
            },
            required: ['act', 'whatToShow', 'whatToSay', 'addresses'],
          },
        },
        answerBank: {
          type: 'array',
          description: 'For RFP responses — 8 pre-drafted Q&A pairs',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
              tailor: { type: 'string', description: 'How to tailor to this specific company' },
            },
            required: ['question', 'answer', 'tailor'],
          },
        },
        objections: {
          type: 'array',
          description: 'Anticipated objections specific to this company — not generic',
          items: {
            type: 'object',
            properties: {
              objection: { type: 'string' },
              counter: { type: 'string' },
              confidence: {
                type: 'string',
                enum: ['HIGH', 'MED', 'LOW'],
                description: 'How likely this objection is given what you found',
              },
            },
            required: ['objection', 'counter', 'confidence'],
          },
        },
      },
      required: ['openingLine', 'objections'],
    },
  },
  {
    name: 'output_email',
    description:
      'Output the follow-up email. Call this LAST — it signals the brief is complete and closes the agent loop. Do not call this until output_call_prep has already been called.',
    input_schema: {
      type: 'object' as const,
      properties: {
        subject: { type: 'string' },
        body: {
          type: 'string',
          description:
            'Full email body. Plain text only — no markdown, no asterisks. Reference the specific call type and prospect context.',
        },
      },
      required: ['subject', 'body'],
    },
  },
];

const TOOLS = [...RESEARCH_TOOLS, ...OUTPUT_TOOLS];
const OUTPUT_TOOL_NAMES = new Set(['output_snapshot', 'output_intelligence', 'output_call_prep', 'output_email']);

// Minimum research tool calls required before output tools are unlocked
const MIN_RESEARCH_CALLS = 4;

// ─── System prompt ──────────────────────────────────────

const SYSTEM_PROMPT = `You are an autonomous Sales Engineering research agent. Your job is to research a real prospect company using live tools and produce a specific, evidence-based call prep brief.

MANDATORY RESEARCH SEQUENCE — you must complete ALL of these before calling any output_ tool:
1. get_news + search_web("${'{prospect}'} company news 2024 2025") in parallel — first response always
2. search_jobs("${'{prospect}'}") — reveals real pain points better than any press release
3. search_web("${'{prospect}'} competitors technology stack challenges") — competitive + tech context
4. search_web("${'{prospect}'} layoffs funding earnings leadership") — financial health signals
5. fetch_url on the single most informative URL from your searches (annual report, press release, or news article)

Only AFTER completing the above 5 research steps, begin outputting:
6. → output_snapshot — company basics, tech stack, stock (if public)
7. → output_intelligence — pain signals, red flags, competitive landscape (ALL grounded in what you found)
8. → output_call_prep — opening line referencing a real recent event, agenda/demo/rfp, objections specific to THIS company
9. → output_email LAST — closes the loop

RULES:
- You cannot skip research steps. The output tools are locked until you have done real research.
- Every pain signal must cite something specific you found (e.g. "3 open DevOps roles suggest infrastructure debt")
- The opening line must reference a real event from your research, not generic praise
- Objections must reflect THIS company's actual situation — not boilerplate
- If a tool returns empty, try a different query — do not skip straight to output
- PARALLEL: call multiple research tools in one response when they are independent

Today's date is ${new Date().toISOString().split('T')[0]}.`;

// ─── Build user prompt ──────────────────────────────────

function buildUserPrompt(body: AgentBody): string {
  return `Research this prospect and prepare a ${body.callType} prep package.

SE Profile:
- Name: ${body.seProfile.name || 'SE'}
- Company: ${body.seProfile.company || 'N/A'}
- Product: ${body.seProfile.product || 'N/A'}
- What it does: ${body.seProfile.whatItDoes || 'N/A'}
- Core strengths: ${body.seProfile.strengths || 'N/A'}
- Known weaknesses: ${body.seProfile.weaknesses || 'N/A'}
- Typical buyer: ${body.seProfile.typicalBuyer || 'N/A'}

Prospect: ${body.prospect}
Call type: ${body.callType}
SE's existing notes: ${body.notes || 'None provided'}

Start now: call get_news and search_web in your FIRST response (in parallel). You must complete at least 5 research tool calls before calling any output_ tool. Go.`;
}

// ─── Thinking message generator ─────────────────────────

function getThinkingMessage(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'search_web':
      return `Searching: "${input.query}"`;
    case 'fetch_url':
      return `Reading: ${(input.url as string).replace(/^https?:\/\//, '').slice(0, 70)}`;
    case 'search_jobs':
      return `Job postings: ${input.company}${input.role_type ? ` (${input.role_type})` : ''}`;
    case 'get_stock_data':
      return `Stock data: ${input.ticker}`;
    case 'get_news':
      return `News: ${input.company}`;
    case 'output_snapshot':
      return 'Outputting company snapshot...';
    case 'output_intelligence':
      return 'Outputting intelligence brief...';
    case 'output_call_prep':
      return 'Outputting call prep...';
    case 'output_email':
      return 'Outputting follow-up email...';
    default:
      return `Running ${toolName}...`;
  }
}

// ─── Summarize tool result ──────────────────────────────

function summarizeResult(toolName: string, result: unknown): string {
  try {
    if (toolName === 'search_web' || toolName === 'search_jobs') {
      const arr = result as Array<{ title?: string }>;
      return `Found ${arr.length} result${arr.length !== 1 ? 's' : ''}${arr.length > 0 && arr[0].title ? `: "${arr[0].title}"` : ''}`;
    }
    if (toolName === 'fetch_url') {
      const r = result as { title?: string; content?: string };
      const len = r.content?.length ?? 0;
      return `Fetched: ${r.title || 'page'} (${Math.round(len / 1000)}k chars)`;
    }
    if (toolName === 'get_stock_data') {
      const r = result as { price?: number; symbol?: string; error?: boolean };
      if (r.error) return 'Stock: private/not found';
      return `${r.symbol} @ $${r.price?.toFixed(2)}`;
    }
    if (toolName === 'get_news') {
      const r = result as { articles?: Array<unknown> };
      return `News: ${r.articles?.length ?? 0} articles`;
    }
    return 'Done';
  } catch {
    return 'Done';
  }
}

// ─── Tool execution ─────────────────────────────────────

async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'search_web': {
      const { tavily_search } = await import('@/lib/tavily');
      return tavily_search(input.query as string);
    }
    case 'fetch_url': {
      const { tavily_extract } = await import('@/lib/tavily');
      return tavily_extract(input.url as string);
    }
    case 'search_jobs': {
      const { tavily_search } = await import('@/lib/tavily');
      const company = input.company as string;
      const roleType = input.role_type as string | undefined;
      const query = `${company} jobs ${roleType || ''} site:linkedin.com OR site:greenhouse.io OR site:lever.co`.trim();
      return tavily_search(query);
    }
    case 'get_stock_data': {
      return getStockData(input.ticker as string, true);
    }
    case 'get_news': {
      return getCompanyNews(input.company as string);
    }
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Parse stock data from message history ──────────────

function extractStockFromHistory(messages: Anthropic.MessageParam[]): {
  stockData: Record<string, unknown> | null;
  stockError: Record<string, unknown> | null;
} {
  let stockData = null;
  let stockError = null;
  for (const msg of messages) {
    if (msg.role !== 'user' || typeof msg.content === 'string') continue;
    const arr = msg.content as Array<{ type: string; content?: string }>;
    for (const block of arr) {
      if (block.type === 'tool_result' && block.content) {
        try {
          const parsed = JSON.parse(block.content);
          if (parsed.symbol && parsed.price) stockData = parsed;
          else if (parsed.error === true) stockError = parsed;
        } catch { /* ignore */ }
      }
    }
  }
  return { stockData, stockError };
}

// ─── SSE endpoint ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const body: AgentBody = await req.json();

  if (!body.prospect) {
    return new Response(
      JSON.stringify({ error: 'Prospect company is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(type: string, data: unknown) {
        const payload = JSON.stringify({ type, data });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }

      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const userPrompt = buildUserPrompt(body);

        const messages: Anthropic.MessageParam[] = [
          { role: 'user', content: userPrompt },
        ];

        let iterations = 0;
        const MAX_ITERATIONS = 15;
        let isDone = false;
        let researchCallCount = 0;

        while (iterations < MAX_ITERATIONS && !isDone) {
          iterations++;

          // Research gate: only expose output tools once enough research has been done
          const availableTools = researchCallCount >= MIN_RESEARCH_CALLS ? TOOLS : RESEARCH_TOOLS;

          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            system: SYSTEM_PROMPT,
            tools: availableTools,
            messages,
          });

          messages.push({ role: 'assistant', content: response.content });

          // Separate research tools from output tools
          const toolBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          );

          if (toolBlocks.length === 0) {
            // Text-only response with no tool calls — agent stopped unexpectedly
            send('error', { message: 'Agent stopped without completing the brief.' });
            break;
          }

          const researchBlocks = toolBlocks.filter(b => !OUTPUT_TOOL_NAMES.has(b.name));
          const outputBlocks = toolBlocks.filter(b => OUTPUT_TOOL_NAMES.has(b.name));

          // ── Execute research tools in PARALLEL ──────────
          researchCallCount += researchBlocks.length;

          const researchResults = await Promise.all(
            researchBlocks.map(async (block) => {
              send('thinking', {
                message: getThinkingMessage(block.name, block.input as Record<string, unknown>),
              });

              let result: unknown;
              try {
                result = await executeTool(block.name, block.input as Record<string, unknown>);
              } catch (err) {
                result = { error: err instanceof Error ? err.message : 'Tool failed' };
              }

              send('tool_result', {
                tool: block.name,
                summary: summarizeResult(block.name, result),
              });

              let resultStr = JSON.stringify(result);
              if (resultStr.length > 8000) {
                resultStr = resultStr.slice(0, 8000) + '... [truncated]';
              }

              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: resultStr,
              };
            })
          );

          // ── Handle output tools (fire card_ready events) ─
          const outputResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of outputBlocks) {
            send('thinking', {
              message: getThinkingMessage(block.name, block.input as Record<string, unknown>),
            });

            // For snapshot, merge live stock data from message history
            let cardData: Record<string, unknown> = block.input as Record<string, unknown>;

            if (block.name === 'output_snapshot') {
              const { stockData, stockError } = extractStockFromHistory(messages);
              cardData = { ...cardData, stock: stockData, stockError };
            }

            send('card_ready', {
              type: block.name.replace('output_', ''),
              data: cardData,
            });

            outputResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: 'Card rendered in UI successfully.',
            });

            if (block.name === 'output_email') {
              isDone = true;
            }
          }

          // Collect all results and continue the loop
          const allResults: Anthropic.ToolResultBlockParam[] = [
            ...researchResults,
            ...outputResults,
          ];

          messages.push({ role: 'user', content: allResults });
        }

        if (iterations >= MAX_ITERATIONS && !isDone) {
          send('error', { message: 'Agent reached maximum iterations.' });
        }

        if (isDone) {
          send('agent_complete', {});
        }
      } catch (err) {
        console.error('[/api/agent] Error:', err);
        send('error', {
          message: err instanceof Error ? err.message : 'Agent encountered an error.',
        });
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

// POST /api/agent — SSE agentic loop
// Claude autonomously decides which tools to call, streams thinking to the UI,
// then produces the final SE prep package via generate_brief tool.

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

// ─── Tool definitions for Claude ────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_web',
    description:
      'Search the web for any query. Use this to find recent news, company announcements, funding rounds, layoffs, product launches, or any current information about the prospect company.',
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
      'Fetch and read the full content of a specific URL. Use this when a search result looks highly relevant and you need the full article.',
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
        role_type: { type: 'string', description: 'Optional role type filter e.g. "engineering" or "sales"' },
      },
      required: ['company'],
    },
  },
  {
    name: 'get_stock_data',
    description: 'Get current stock price and recent performance for a public company. Use ticker symbol.',
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
  {
    name: 'generate_brief',
    description:
      'Call this tool when you have gathered enough intelligence and are ready to generate the final SE prep package. This ends the research loop.',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyIntel: {
          type: 'object',
          properties: {
            snapshot: {
              type: 'object',
              properties: {
                revenue: { type: 'string', description: 'Annual revenue e.g. "$383B (FY2024)"' },
                marketCap: { type: 'string', description: 'Market capitalization e.g. "$3.68T"' },
                growth: { type: 'string', description: 'YoY revenue growth e.g. "+12%"' },
                ceo: { type: 'string', description: 'CEO name' },
                founded: { type: 'string', description: 'Year founded e.g. "1998"' },
                employees: { type: 'string', description: 'Approximate headcount e.g. "~182,000"' },
                description: { type: 'string', description: 'One-sentence company description' },
              },
              required: ['revenue', 'marketCap', 'growth', 'ceo', 'founded', 'employees', 'description'],
            },
            painSignals: { type: 'array', items: { type: 'string' } },
            techStack: { type: 'array', items: { type: 'string' } },
            recentDevelopments: { type: 'array', items: { type: 'string' } },
            jobPostingInsights: { type: 'array', items: { type: 'string' } },
            competitiveLandscape: { type: 'string' },
          },
          required: ['snapshot', 'painSignals', 'techStack', 'recentDevelopments', 'competitiveLandscape'],
        },
        callType: { type: 'string', enum: ['discovery', 'demo', 'rfp'] },
        output: {
          type: 'object',
          properties: {
            agenda: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item: { type: 'string' },
                  question: { type: 'string' },
                  why: { type: 'string' },
                },
                required: ['item', 'question', 'why'],
              },
            },
            demoScript: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  act: { type: 'string' },
                  whatToShow: { type: 'string' },
                  whatToSay: { type: 'string' },
                  addresses: { type: 'string' },
                },
                required: ['act', 'whatToShow', 'whatToSay', 'addresses'],
              },
            },
            answerBank: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' },
                  tailor: { type: 'string' },
                },
                required: ['question', 'answer', 'tailor'],
              },
            },
            objections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  objection: { type: 'string' },
                  counter: { type: 'string' },
                  confidence: { type: 'string' },
                },
                required: ['objection', 'counter', 'confidence'],
              },
            },
            followUpEmail: {
              type: 'object',
              properties: {
                subject: { type: 'string' },
                body: { type: 'string' },
              },
              required: ['subject', 'body'],
            },
            openingLine: { type: 'string' },
          },
          required: ['objections', 'followUpEmail', 'openingLine'],
        },
      },
      required: ['companyIntel', 'callType', 'output'],
    },
  },
];

// ─── System prompt ──────────────────────────────────────

const SYSTEM_PROMPT = `You are an autonomous Sales Engineering research agent. Your job is to thoroughly research a prospect company and produce a complete call prep package for a Sales Engineer.

You have access to tools. Use them proactively and intelligently:
- Always search for recent news first to understand current context
- Always search job postings — they reveal pain points better than anything
- Fetch full articles when headlines suggest something important
- Search for the company's tech stack
- Look for funding, layoffs, leadership changes, product launches
- Cross-reference everything against the SE's product strengths

Research process (be efficient — aim for 4-6 total tool calls, not more):
1. Start with a broad news search
2. Optionally fetch one highly relevant article
3. Search job postings to infer internal priorities
4. Get stock data if public company
5. Once you have strong signal, call generate_brief IMMEDIATELY — do not over-research

Quality bar:
- Every talking point must reference something specific you found
- Objections must be realistic for THIS company, not generic
- The opening line must reference a specific recent event
- Demo script acts must map to specific pain signals you discovered

When you have enough intelligence (after 4-6 tool calls), call generate_brief immediately. Do NOT keep searching — wrap up quickly. Speed matters.

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

Begin your research now. Use your tools. When ready, call generate_brief.`;
}

// ─── Thinking message generator ─────────────────────────

function getThinkingMessage(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'search_web':
      return `Searching for "${input.query}"...`;
    case 'fetch_url':
      return `Reading article: ${(input.url as string).slice(0, 80)}...`;
    case 'search_jobs':
      return `Searching ${input.company} job postings${input.role_type ? ` (${input.role_type})` : ''}...`;
    case 'get_stock_data':
      return `Fetching stock data for ${input.ticker}...`;
    case 'get_news':
      return `Fetching recent news for ${input.company}...`;
    case 'generate_brief':
      return 'Building your prep package...';
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
      return `Fetched ${r.title || 'page'} (${Math.round(len / 1000)}k chars)`;
    }
    if (toolName === 'get_stock_data') {
      const r = result as { price?: number; symbol?: string; error?: boolean };
      if (r.error) return 'Stock data not available (private or not found)';
      return `${r.symbol} @ $${r.price}`;
    }
    if (toolName === 'get_news') {
      const r = result as { articles?: Array<unknown> };
      return `Found ${r.articles?.length ?? 0} recent articles`;
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
      const result = await getStockData(input.ticker as string, true);
      return result;
    }
    case 'get_news': {
      const result = await getCompanyNews(input.company as string);
      return result;
    }
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
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
        const MAX_ITERATIONS = 6;

        while (iterations < MAX_ITERATIONS) {
          iterations++;

          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages,
          });

          // Add assistant response to message history
          messages.push({ role: 'assistant', content: response.content });

          // Check for generate_brief (stop condition)
          const generateBriefCall = response.content.find(
            (block): block is Anthropic.ToolUseBlock =>
              block.type === 'tool_use' && block.name === 'generate_brief'
          );

          if (generateBriefCall) {
            send('thinking', { message: 'Building your prep package...' });

            const briefInput = generateBriefCall.input as {
              companyIntel: Record<string, unknown>;
              output: Record<string, unknown>;
            };

            // Also try to get stock data from one of the earlier tool calls
            let stockData = null;
            let stockError = null;
            // Search message history for stock data
            for (const msg of messages) {
              if (msg.role !== 'user' || typeof msg.content === 'string') continue;
              const arr = msg.content as Array<{ type: string; content?: string; tool_use_id?: string }>;
              for (const block of arr) {
                if (block.type === 'tool_result' && block.content) {
                  try {
                    const parsed = JSON.parse(block.content);
                    if (parsed.symbol && parsed.price) {
                      stockData = parsed;
                    } else if (parsed.error === true) {
                      stockError = parsed;
                    }
                  } catch { /* ignore */ }
                }
              }
            }

            send('brief_ready', {
              brief: briefInput.output,
              companyIntel: briefInput.companyIntel,
              callType: body.callType,
              stock: stockData,
              stockError,
            });
            break;
          }

          // Execute all tool calls the agent made
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type !== 'tool_use') continue;

            // Stream thinking message
            send('thinking', {
              message: getThinkingMessage(block.name, block.input as Record<string, unknown>),
            });

            // Execute the tool
            let result: unknown;
            try {
              result = await executeTool(block.name, block.input as Record<string, unknown>);
            } catch (err) {
              result = { error: err instanceof Error ? err.message : 'Tool execution failed' };
            }

            // Stream tool result summary
            send('tool_result', {
              tool: block.name,
              summary: summarizeResult(block.name, result),
            });

            // Truncate large results to keep context manageable
            let resultStr = JSON.stringify(result);
            if (resultStr.length > 4000) {
              resultStr = resultStr.slice(0, 4000) + '... [truncated]';
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: resultStr,
            });
          }

          // If no tool calls were made (text-only response), we're done
          if (toolResults.length === 0) {
            send('error', { message: 'Agent stopped without generating a brief.' });
            break;
          }

          // Add tool results to message history and loop
          messages.push({ role: 'user', content: toolResults });
        }

        if (iterations >= MAX_ITERATIONS) {
          send('error', { message: 'Agent reached maximum iterations without completing.' });
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

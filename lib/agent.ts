// Core agentic loop — used by both the SSE streaming route and the background cron trigger.

import Anthropic from '@anthropic-ai/sdk';
import { getStockData } from '@/lib/alphaVantage';
import { getCompanyNews } from '@/lib/newsApi';

// ─── Types ───────────────────────────────────────────────

export interface AgentParams {
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

export interface AgentEvent {
  type: 'thinking' | 'tool_result' | 'card_ready' | 'agent_complete' | 'error';
  data: Record<string, unknown>;
}

// ─── Tool definitions ────────────────────────────────────

const RESEARCH_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_web',
    description:
      'Search the web for any query. Use this to find recent news, company announcements, funding rounds, layoffs, product launches, pricing, or any current information.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'fetch_url',
    description:
      'Fetch and read the full content of a specific URL. Use when a search result looks highly relevant and you need the full article or page.',
    input_schema: {
      type: 'object' as const,
      properties: { url: { type: 'string', description: 'URL to fetch' } },
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
        role_type: { type: 'string', description: 'Optional role type filter e.g. "engineering"' },
      },
      required: ['company'],
    },
  },
  {
    name: 'get_stock_data',
    description: 'Get current stock price and recent performance for a public company.',
    input_schema: {
      type: 'object' as const,
      properties: { ticker: { type: 'string', description: 'Stock ticker symbol e.g. AAPL' } },
      required: ['ticker'],
    },
  },
  {
    name: 'get_news',
    description: 'Get recent news headlines for a company from NewsAPI.',
    input_schema: {
      type: 'object' as const,
      properties: { company: { type: 'string', description: 'Company name' } },
      required: ['company'],
    },
  },
];

const OUTPUT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'output_snapshot',
    description:
      'Output the company snapshot card. Call this as soon as you have basic company context — do NOT wait for all research to complete.',
    input_schema: {
      type: 'object' as const,
      properties: {
        snapshot: {
          type: 'object',
          properties: {
            revenue: { type: 'string' },
            marketCap: { type: 'string' },
            growth: { type: 'string' },
            ceo: { type: 'string' },
            founded: { type: 'string' },
            employees: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['revenue', 'marketCap', 'growth', 'ceo', 'founded', 'employees', 'description'],
        },
        techStack: { type: 'array', items: { type: 'string' } },
        stockSymbol: { type: 'string' },
        stockIsPublic: { type: 'boolean' },
      },
      required: ['snapshot', 'techStack'],
    },
  },
  {
    name: 'output_intelligence',
    description: 'Output pain signals, job insights, and competitive context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        painSignals: { type: 'array', items: { type: 'string' } },
        jobPostingInsights: { type: 'array', items: { type: 'string' } },
        recentDevelopments: { type: 'array', items: { type: 'string' } },
        redFlags: { type: 'array', items: { type: 'string' } },
        competitiveLandscape: { type: 'string' },
      },
      required: ['painSignals', 'recentDevelopments', 'competitiveLandscape'],
    },
  },
  {
    name: 'output_call_prep',
    description: 'Output the call-specific prep package: opening line, agenda/demo/RFP, objections.',
    input_schema: {
      type: 'object' as const,
      properties: {
        openingLine: { type: 'string' },
        agenda: {
          type: 'array',
          items: {
            type: 'object',
            properties: { item: { type: 'string' }, question: { type: 'string' }, why: { type: 'string' } },
            required: ['item', 'question', 'why'],
          },
        },
        demoScript: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              act: { type: 'string' }, whatToShow: { type: 'string' },
              whatToSay: { type: 'string' }, addresses: { type: 'string' },
            },
            required: ['act', 'whatToShow', 'whatToSay', 'addresses'],
          },
        },
        answerBank: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' }, answer: { type: 'string' }, tailor: { type: 'string' },
            },
            required: ['question', 'answer', 'tailor'],
          },
        },
        objections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              objection: { type: 'string' }, counter: { type: 'string' },
              confidence: { type: 'string', enum: ['HIGH', 'MED', 'LOW'] },
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
    description: 'Output the follow-up email. Call this LAST — closes the agent loop.',
    input_schema: {
      type: 'object' as const,
      properties: {
        subject: { type: 'string' },
        body: { type: 'string', description: 'Full email body. Plain text only.' },
      },
      required: ['subject', 'body'],
    },
  },
];

const ALL_TOOLS = [...RESEARCH_TOOLS, ...OUTPUT_TOOLS];
const OUTPUT_TOOL_NAMES = new Set(['output_snapshot', 'output_intelligence', 'output_call_prep', 'output_email']);
const MIN_RESEARCH_CALLS = 4;

// ─── System + user prompts ───────────────────────────────

const SYSTEM_PROMPT = `You are an autonomous Sales Engineering research agent. Your job is to research a real prospect company using live tools and produce a specific, evidence-based call prep brief.

MANDATORY RESEARCH SEQUENCE — you must complete ALL of these before calling any output_ tool:
1. get_news + search_web("{prospect} company news 2024 2025") in parallel — first response always
2. search_jobs("{prospect}") — reveals real pain points better than any press release
3. search_web("{prospect} competitors technology stack challenges") — competitive + tech context
4. search_web("{prospect} layoffs funding earnings leadership") — financial health signals
5. fetch_url on the single most informative URL from your searches

Only AFTER completing the above 5 research steps, begin outputting:
6. → output_snapshot — company basics, tech stack, stock (if public)
7. → output_intelligence — pain signals, red flags, competitive landscape (ALL grounded in what you found)
8. → output_call_prep — opening line referencing a real recent event, agenda/demo/rfp, objections specific to THIS company
9. → output_email LAST — closes the loop

RULES:
- You cannot skip research steps. The output tools are locked until you have done real research.
- Every pain signal must cite something specific you found
- The opening line must reference a real event from your research, not generic praise
- Objections must reflect THIS company's actual situation — not boilerplate
- If a tool returns empty, try a different query — do not skip straight to output
- PARALLEL: call multiple research tools in one response when they are independent

Today's date is ${new Date().toISOString().split('T')[0]}.`;

function buildUserPrompt(params: AgentParams): string {
  return `Research this prospect and prepare a ${params.callType} prep package.

SE Profile:
- Name: ${params.seProfile.name || 'SE'}
- Company: ${params.seProfile.company || 'N/A'}
- Product: ${params.seProfile.product || 'N/A'}
- What it does: ${params.seProfile.whatItDoes || 'N/A'}
- Core strengths: ${params.seProfile.strengths || 'N/A'}
- Known weaknesses: ${params.seProfile.weaknesses || 'N/A'}
- Typical buyer: ${params.seProfile.typicalBuyer || 'N/A'}

Prospect: ${params.prospect}
Call type: ${params.callType}
SE's existing notes: ${params.notes || 'None provided'}

Start now: call get_news and search_web in your FIRST response (in parallel). You must complete at least 5 research tool calls before calling any output_ tool. Go.`;
}

// ─── Helpers ─────────────────────────────────────────────

function getThinkingMessage(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'search_web': return `Searching: "${input.query}"`;
    case 'fetch_url': return `Reading: ${(input.url as string).replace(/^https?:\/\//, '').slice(0, 70)}`;
    case 'search_jobs': return `Job postings: ${input.company}${input.role_type ? ` (${input.role_type})` : ''}`;
    case 'get_stock_data': return `Stock data: ${input.ticker}`;
    case 'get_news': return `News: ${input.company}`;
    case 'output_snapshot': return 'Outputting company snapshot...';
    case 'output_intelligence': return 'Outputting intelligence brief...';
    case 'output_call_prep': return 'Outputting call prep...';
    case 'output_email': return 'Outputting follow-up email...';
    default: return `Running ${toolName}...`;
  }
}

function summarizeResult(toolName: string, result: unknown): string {
  try {
    if (toolName === 'search_web' || toolName === 'search_jobs') {
      const arr = result as Array<{ title?: string }>;
      return `Found ${arr.length} result${arr.length !== 1 ? 's' : ''}${arr.length > 0 && arr[0].title ? `: "${arr[0].title}"` : ''}`;
    }
    if (toolName === 'fetch_url') {
      const r = result as { title?: string; content?: string };
      return `Fetched: ${r.title || 'page'} (${Math.round((r.content?.length ?? 0) / 1000)}k chars)`;
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
  } catch { return 'Done'; }
}

async function executeTool(toolName: string, input: Record<string, unknown>): Promise<unknown> {
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
      const query = `${input.company} jobs ${input.role_type || ''} site:linkedin.com OR site:greenhouse.io OR site:lever.co`.trim();
      return tavily_search(query);
    }
    case 'get_stock_data': return getStockData(input.ticker as string, true);
    case 'get_news': return getCompanyNews(input.company as string);
    default: return { error: `Unknown tool: ${toolName}` };
  }
}

function extractStockFromHistory(messages: Anthropic.MessageParam[]): {
  stockData: Record<string, unknown> | null;
  stockError: Record<string, unknown> | null;
} {
  let stockData = null;
  let stockError = null;
  for (const msg of messages) {
    if (msg.role !== 'user' || typeof msg.content === 'string') continue;
    for (const block of msg.content as Array<{ type: string; content?: string }>) {
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

// ─── Core loop ───────────────────────────────────────────

export async function runAgentLoop(
  params: AgentParams,
  onEvent: (event: AgentEvent) => void
): Promise<void> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: buildUserPrompt(params) }];

  let iterations = 0;
  const MAX_ITERATIONS = 15;
  let isDone = false;
  let researchCallCount = 0;

  while (iterations < MAX_ITERATIONS && !isDone) {
    iterations++;

    const availableTools = researchCallCount >= MIN_RESEARCH_CALLS ? ALL_TOOLS : RESEARCH_TOOLS;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: availableTools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    if (toolBlocks.length === 0) {
      onEvent({ type: 'error', data: { message: 'Agent stopped without completing the brief.' } });
      return;
    }

    const researchBlocks = toolBlocks.filter(b => !OUTPUT_TOOL_NAMES.has(b.name));
    const outputBlocks = toolBlocks.filter(b => OUTPUT_TOOL_NAMES.has(b.name));

    researchCallCount += researchBlocks.length;

    const researchResults = await Promise.all(
      researchBlocks.map(async (block) => {
        const input = block.input as Record<string, unknown>;
        onEvent({ type: 'thinking', data: { message: getThinkingMessage(block.name, input) } });

        let result: unknown;
        try { result = await executeTool(block.name, input); }
        catch (err) { result = { error: err instanceof Error ? err.message : 'Tool failed' }; }

        onEvent({ type: 'tool_result', data: { tool: block.name, summary: summarizeResult(block.name, result) } });

        let resultStr = JSON.stringify(result);
        if (resultStr.length > 8000) resultStr = resultStr.slice(0, 8000) + '... [truncated]';

        return { type: 'tool_result' as const, tool_use_id: block.id, content: resultStr };
      })
    );

    const outputResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of outputBlocks) {
      const input = block.input as Record<string, unknown>;
      onEvent({ type: 'thinking', data: { message: getThinkingMessage(block.name, input) } });

      let cardData: Record<string, unknown> = input;
      if (block.name === 'output_snapshot') {
        const { stockData, stockError } = extractStockFromHistory(messages);
        cardData = { ...cardData, stock: stockData, stockError };
      }

      onEvent({ type: 'card_ready', data: { type: block.name.replace('output_', ''), data: cardData } });

      outputResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Card rendered successfully.' });

      if (block.name === 'output_email') isDone = true;
    }

    messages.push({ role: 'user', content: [...researchResults, ...outputResults] });
  }

  if (iterations >= MAX_ITERATIONS && !isDone) {
    onEvent({ type: 'error', data: { message: 'Agent reached maximum iterations.' } });
    return;
  }

  if (isDone) onEvent({ type: 'agent_complete', data: {} });
}

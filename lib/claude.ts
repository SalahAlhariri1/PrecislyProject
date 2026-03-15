// Anthropic Claude API integration
// Resolves company identity + generates deep SE intelligence brief

import Anthropic from '@anthropic-ai/sdk';

// ─── Company Resolution ────────────────────────────────────────

export interface CompanyResolution {
  name: string;
  ticker: string | null;
  isPublic: boolean;
}

export async function resolveCompany(input: string): Promise<CompanyResolution> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Given this input: '${input}', return JSON only with no markdown:
{
  "name": string,
  "ticker": string | null,
  "isPublic": boolean
}
name should be the proper company name e.g. 'Apple' not 'apple.com'. ticker is the stock ticker symbol e.g. 'AAPL', or null if private.`,
    }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(text) as CompanyResolution;
}

// ─── Snapshot (still needed for the basics) ─────────────────────

export interface CompanySnapshot {
  revenue: string;
  marketCap: string;
  growth: string;
  ceo: string;
  founded: string;
  employees: string;
  description: string;
}

// ─── Deep Brief types ───────────────────────────────────────────

export interface PainSignal {
  signal: string;
  why: string;
}

export interface TechStack {
  likely: string[];
  source: string;
}

export interface CompetitivePressure {
  competitors: string[];
  insight: string;
}

export interface DecisionMaker {
  title: string;
  focus: string;
}

export interface TalkingPoint {
  point: string;
  evidence: string;
}

export interface ClaudeResult {
  snapshot: CompanySnapshot;
  painSignals: PainSignal[];
  techStack: TechStack;
  competitivePressure: CompetitivePressure;
  decisionMakers: DecisionMaker[];
  openingLine: string;
  redFlags: string[];
  talkingPoints: TalkingPoint[];
}

// ─── System + user prompts ──────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior Sales Engineer with 15 years of B2B enterprise software experience. You think like a consultant, not a salesperson. Your job is to help another SE walk into a customer call already knowing things the customer hasn't told them yet. Today's date is ${new Date().toISOString().split('T')[0]}.`;

function buildUserPrompt(
  name: string,
  ticker: string | null,
  newsHeadlines: string[],
  stockChange: string
): string {
  const headlinesStr = newsHeadlines.length > 0
    ? newsHeadlines.map(h => `- ${h}`).join('\n')
    : 'No recent headlines available';

  return `Company: ${name}
Ticker: ${ticker ?? 'N/A (private)'}
Recent headlines:
${headlinesStr}
Stock change today: ${stockChange}

Analyze this company and return JSON only, no markdown, with this exact structure:
{
  "snapshot": { "revenue": string, "marketCap": string, "growth": string, "ceo": string, "founded": string, "employees": string, "description": string },
  "painSignals": [
    { "signal": string, "why": string }
  ],
  "techStack": {
    "likely": string[],
    "source": string
  },
  "competitivePressure": {
    "competitors": string[],
    "insight": string
  },
  "decisionMakers": [
    { "title": string, "focus": string }
  ],
  "openingLine": string,
  "redFlags": string[],
  "talkingPoints": [
    { "point": string, "evidence": string }
  ]
}

Rules:
- snapshot: use the most recent fiscal year data you know. For revenue and marketCap include the year label.
- painSignals: 3 specific signals that suggest THIS company has a problem right now. Each signal needs a 'why' explaining what it means for a vendor conversation.
- techStack.likely: infer their probable stack from their industry, size, and what companies like them typically use. Be specific (e.g. 'Salesforce CRM', 'AWS', 'Snowflake') not generic (e.g. 'cloud provider').
- competitivePressure.insight: one sharp observation about how their competitive position creates urgency or opportunity for a vendor.
- decisionMakers: the 3 most likely buyer titles at this company and what each one cares about professionally.
- openingLine: one sentence an SE could literally say at the start of a call to immediately show they've done their homework. Make it specific to current events, not generic flattery.
- redFlags: 1-2 things that could kill this deal (budget freeze signals, recent layoffs, leadership turnover, etc). Empty array if none detected.
- talkingPoints: 3 researched talking points. Each needs an 'evidence' string citing what data supports it.

Return only valid JSON.`;
}

// ─── Main export ────────────────────────────────────────────────

export async function generateBrief(
  companyName: string,
  ticker: string | null,
  newsHeadlines: string[],
  stockChange: string
): Promise<ClaudeResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: buildUserPrompt(companyName, ticker, newsHeadlines, stockChange),
    }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  return JSON.parse(text) as ClaudeResult;
}

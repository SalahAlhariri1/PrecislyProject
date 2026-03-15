// Anthropic Claude API integration
// Resolves company identity + generates snapshot + SE talking points

import Anthropic from '@anthropic-ai/sdk';

export interface CompanyResolution {
  name: string;       // proper name e.g. 'Apple'
  ticker: string | null; // stock ticker e.g. 'AAPL', or null if private
  isPublic: boolean;
}

// Step 1: resolve raw user input into structured company info
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

export interface CompanySnapshot {
  revenue: string;
  marketCap: string;
  growth: string;
  ceo: string;
  founded: string;
  employees: string;
  description: string;
}

export interface ClaudeResult {
  snapshot: CompanySnapshot;
  talkingPoints: [string, string, string];
}

const SYSTEM_PROMPT = `You are a sales intelligence assistant for B2B Sales Engineers. Given a company name and recent news, return a JSON object with this exact structure:
{
  snapshot: { revenue: string, marketCap: string, growth: string, ceo: string, founded: string, employees: string, description: string },
  talkingPoints: [string, string, string]
}
For talkingPoints, write 1-2 sentence insights a Sales Engineer should use before a customer call. Focus on: their current strategic priorities, internal pressures, and how a vendor could add value. Be specific, not generic. Return only valid JSON, no markdown.`;

export async function generateBrief(
  companyName: string,
  newsHeadlines: string[]
): Promise<ClaudeResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const newsContext =
    newsHeadlines.length > 0
      ? `\n\nRecent news headlines:\n${newsHeadlines.map(h => `- ${h}`).join('\n')}`
      : '\n\nNo recent news available.';

  const userMessage = `Company: ${companyName}${newsContext}\n\nGenerate the sales intelligence brief.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';

  // Strip markdown code fences if Claude wraps the response in ```json ... ```
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Parse the JSON response
  const parsed: ClaudeResult = JSON.parse(text);
  return parsed;
}

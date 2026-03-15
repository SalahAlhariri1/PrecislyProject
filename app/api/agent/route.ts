// POST /api/agent
// Generates call-type-specific SE prep using Claude
// Receives: SE profile + prospect data + call type
// Returns: agenda/demo/rfp content + objections + follow-up email

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are an elite Sales Engineering coach with 20 years of experience closing enterprise B2B deals. You know exactly what happens in discovery calls, demos, and RFP responses. You give specific, opinionated, battle-tested advice — never generic. You know the prospect company, you know the SE's product, and you write everything as if the call is tomorrow. Today's date is ${new Date().toISOString().split('T')[0]}.`;

function buildSEContext(body: AgentBody): string {
  return `SE Profile:
- Name: ${body.seProfile.name || 'SE'}
- Selling: ${body.seProfile.product || 'their product'} by ${body.seProfile.company || 'their company'}
- What it does: ${body.seProfile.whatItDoes || 'N/A'}
- Core strengths: ${body.seProfile.strengths || 'N/A'}
- Known weaknesses: ${body.seProfile.weaknesses || 'N/A'}
- Typical buyer: ${body.seProfile.typicalBuyer || 'N/A'}

Prospect: ${body.prospect}
Recent news about them: ${body.companyData.news?.map((a: { title: string }) => `- ${a.title}`).join('\n') || 'None available'}
Their likely tech stack: ${body.companyData.techStack?.join(', ') || 'Unknown'}
Company snapshot: Revenue ${body.companyData.snapshot?.revenue || 'N/A'}, CEO ${body.companyData.snapshot?.ceo || 'N/A'}, Market cap ${body.companyData.snapshot?.marketCap || 'N/A'}
Stock change today: ${body.companyData.stockChange || 'N/A'}
Pain signals detected: ${body.companyData.painSignals?.map((p: { signal: string }) => p.signal).join('; ') || 'N/A'}
SE's notes: ${body.notes || 'None provided'}`;
}

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
  companyData: {
    snapshot?: { revenue?: string; ceo?: string; marketCap?: string };
    news?: { title: string }[];
    stockChange?: string;
    techStack?: string[];
    painSignals?: { signal: string }[];
  };
}

function buildDiscoveryPrompt(body: AgentBody): string {
  const ctx = buildSEContext(body);
  return `${ctx}

Generate a discovery call prep package. Return JSON only, no markdown:
{
  "agenda": [
    { "item": string, "question": string, "why": string }
  ],
  "objections": [
    { "objection": string, "counter": string, "confidence": "HIGH" | "MED" | "LOW" }
  ],
  "followUpEmail": {
    "subject": string,
    "body": string
  }
}
Rules:
- agenda: exactly 5 items. Each question should be open-ended and specific to THIS prospect, not generic. The 'why' should connect directly to ${body.seProfile.product || 'the product'}'s value prop.
- objections: 3-5 real objections an SE at THIS company would raise. Make the counters specific to ${body.seProfile.product || 'the product'}'s strengths — not generic rebuttals.
- followUpEmail: write a real email ${body.seProfile.name || 'the SE'} would send from ${body.seProfile.company || 'their company'} after a discovery call with this prospect. Reference something specific about their situation. Professional but human. Under 150 words.`;
}

function buildDemoPrompt(body: AgentBody): string {
  const ctx = buildSEContext(body);
  return `${ctx}

Generate a product demo prep package. Return JSON only, no markdown:
{
  "demoScript": [
    { "act": string, "whatToShow": string, "whatToSay": string, "addresses": string }
  ],
  "objections": [
    { "objection": string, "counter": string, "confidence": "HIGH" | "MED" | "LOW" }
  ],
  "followUpEmail": {
    "subject": string,
    "body": string
  }
}
Rules:
- demoScript: exactly 5 acts. Structure as: Hook → Problem → Solution → Proof → Call to Action. Each act's whatToSay is one sentence the SE literally says out loud. Each act must address a specific pain signal from this prospect.
- objections: 3-5 real objections. Make counters specific to ${body.seProfile.product || 'the product'}'s strengths.
- followUpEmail: reference specific demo moments. Professional but human. Under 150 words.`;
}

function buildRFPPrompt(body: AgentBody): string {
  const ctx = buildSEContext(body);
  return `${ctx}

Generate an RFP response prep package. Return JSON only, no markdown:
{
  "answerBank": [
    { "question": string, "answer": string, "tailor": string }
  ],
  "objections": [
    { "objection": string, "counter": string, "confidence": "HIGH" | "MED" | "LOW" }
  ],
  "coverEmail": {
    "subject": string,
    "body": string
  }
}
Rules:
- answerBank: exactly 8 questions. Cover: security, scalability, integration, pricing model, implementation timeline, support, competitive differentiation, and ROI. Answers should be written using ${body.seProfile.product || 'the product'}'s actual strengths. The 'tailor' note tells the SE what to customize before sending.
- objections: 3-5 real objections. Make counters specific to ${body.seProfile.product || 'the product'}'s strengths.
- coverEmail: a professional cover email for submitting the RFP response. Under 150 words.`;
}

export async function POST(req: NextRequest) {
  try {
    const body: AgentBody = await req.json();

    if (!body.prospect) {
      return NextResponse.json({ error: 'Prospect company is required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let userPrompt: string;
    switch (body.callType) {
      case 'demo':     userPrompt = buildDemoPrompt(body);      break;
      case 'rfp':      userPrompt = buildRFPPrompt(body);       break;
      case 'discovery':
      default:         userPrompt = buildDiscoveryPrompt(body);  break;
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(text);

    return NextResponse.json({ callType: body.callType, ...parsed });
  } catch (err) {
    console.error('[/api/agent] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate call prep. Please try again.' },
      { status: 500 }
    );
  }
}

// POST /api/brief
// Step 1: resolve company identity via Claude
// Step 2: fetch stock (by ticker) + news (by name) in parallel
// Step 3: generate snapshot + talking points via Claude

import { NextRequest, NextResponse } from 'next/server';
import { getStockData } from '@/lib/alphaVantage';
import { getCompanyNews } from '@/lib/newsApi';
import { resolveCompany, generateBrief } from '@/lib/claude';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawInput: string = (body.company ?? '').trim();

    if (!rawInput) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    // Step 1: resolve raw input → proper name + ticker + isPublic
    const resolved = await resolveCompany(rawInput);

    // Step 2: fetch stock + news in parallel using resolved info
    const [stockResult, newsResult] = await Promise.all([
      getStockData(resolved.ticker, resolved.isPublic),
      getCompanyNews(resolved.name),
    ]);

    // Step 3: generate snapshot + talking points with Claude
    const headlines = newsResult.articles.map(a => a.title);
    const claudeResult = await generateBrief(resolved.name, headlines);

    const response = {
      company: resolved.name,       // display the proper name, not raw input
      ticker: resolved.ticker,
      isPublic: resolved.isPublic,
      fetchedAt: new Date().toUTCString(),
      stock: 'error' in stockResult ? null : stockResult,
      stockError: 'error' in stockResult ? stockResult : null,
      news: newsResult,
      snapshot: claudeResult.snapshot,
      talkingPoints: claudeResult.talkingPoints,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[/api/brief] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate brief. Please try again.' },
      { status: 500 }
    );
  }
}

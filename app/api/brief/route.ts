// POST /api/brief
// Orchestrates Alpha Vantage + NewsAPI + Claude to produce a full company brief

import { NextRequest, NextResponse } from 'next/server';
import { getStockData } from '@/lib/alphaVantage';
import { getCompanyNews } from '@/lib/newsApi';
import { generateBrief } from '@/lib/claude';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const company: string = (body.company ?? '').trim();

    if (!company) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    // Fire stock + news in parallel, then pass to Claude
    const [stockResult, newsResult] = await Promise.all([
      getStockData(company),
      getCompanyNews(company),
    ]);

    // Extract headlines for Claude context
    const headlines = newsResult.articles.map(a => a.title);

    // Generate snapshot + talking points with Claude
    const claudeResult = await generateBrief(company, headlines);

    // Combine everything
    const response = {
      company,
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

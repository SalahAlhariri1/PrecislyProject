// Finnhub API integration (replaces Alpha Vantage)
// 60 calls/minute on free tier — no daily cap
// 2 calls per brief: /quote (price) + /stock/profile2 (market cap)

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: string;
  sparkline: number[];
}

export interface StockError {
  error: true;
  reason: 'private' | 'not_found' | 'api_error';
}

export type StockResult = StockQuote | StockError;

export interface CompanyOverview {
  marketCap: string;
  revenue: string;
  growth: string;
}

const fmt = (n: number) => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(0)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
};

// GET /quote — real-time price data
export async function getStockData(ticker: string | null, isPublic: boolean): Promise<StockResult> {
  if (!isPublic || !ticker) return { error: true, reason: 'private' };

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return { error: true, reason: 'api_error' };

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`,
      { next: { revalidate: 0 } }
    );
    const data = await res.json();

    // c = current price; if 0 or missing, ticker not found
    if (!data.c || data.c === 0) return { error: true, reason: 'not_found' };

    return {
      symbol: ticker,
      price: data.c,
      change: data.d ?? 0,
      changePercent: data.dp ?? 0,
      high: data.h ?? 0,
      low: data.l ?? 0,
      volume: 'N/A',   // requires premium on Finnhub
      sparkline: [],
    };
  } catch {
    return { error: true, reason: 'api_error' };
  }
}

// GET /stock/profile2 — market cap + company info
export async function getCompanyOverview(ticker: string): Promise<CompanyOverview | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${apiKey}`,
      { next: { revalidate: 0 } }
    );
    const data = await res.json();

    // marketCapitalization is in millions USD
    if (!data.marketCapitalization) return null;

    const marketCapRaw = data.marketCapitalization * 1e6;

    return {
      marketCap: fmt(marketCapRaw),
      revenue:   '',   // will be filled by Claude (Finnhub free tier lacks TTM revenue)
      growth:    '',
    };
  } catch {
    return null;
  }
}

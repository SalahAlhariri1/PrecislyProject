// Alpha Vantage API integration
// 2 calls per brief: GLOBAL_QUOTE (price) + OVERVIEW (fundamentals)
// Sparkline removed to stay within 25 req/day free tier limit

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

// Fetch current quote (1 API call)
async function fetchQuote(symbol: string): Promise<StockQuote | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return null;

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const data = await res.json();

  const q = data?.['Global Quote'];
  if (data?.Note || data?.Information) {
    console.log('[alphaVantage] rate limited:', data.Note ?? data.Information);
    return null;
  }
  if (!q || !q['05. price']) return null;

  return {
    symbol,
    price: parseFloat(q['05. price']),
    change: parseFloat(q['09. change']),
    changePercent: parseFloat(q['10. change percent']?.replace('%', '') ?? '0'),
    high: parseFloat(q['03. high']),
    low: parseFloat(q['04. low']),
    volume: parseInt(q['06. volume']).toLocaleString(),
    sparkline: [], // sparkline removed to save API calls
  };
}

// Fetch live fundamentals (1 API call)
export async function getCompanyOverview(ticker: string): Promise<CompanyOverview | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();

    if (!data.MarketCapitalization) return null;

    const fmt = (n: number) => {
      if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
      if (n >= 1e9)  return `$${(n / 1e9).toFixed(0)}B`;
      if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
      return `$${n.toLocaleString()}`;
    };

    const marketCapRaw = parseInt(data.MarketCapitalization);
    const revenueRaw   = parseInt(data.RevenueTTM);
    const growthRaw    = parseFloat(data.QuarterlyRevenueGrowthYOY);

    return {
      marketCap: fmt(marketCapRaw),
      revenue:   `${fmt(revenueRaw)} (TTM)`,
      growth:    isNaN(growthRaw) ? 'N/A' : `${(growthRaw * 100).toFixed(1)}% YoY (TTM)`,
    };
  } catch {
    return null;
  }
}

// Main export: get stock quote using pre-resolved ticker
export async function getStockData(ticker: string | null, isPublic: boolean): Promise<StockResult> {
  if (!isPublic || !ticker) return { error: true, reason: 'private' };

  try {
    const quote = await fetchQuote(ticker);
    if (!quote) return { error: true, reason: 'api_error' };
    return quote;
  } catch {
    return { error: true, reason: 'api_error' };
  }
}

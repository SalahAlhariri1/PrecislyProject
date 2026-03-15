// Alpha Vantage API integration
// Fetches real-time stock quote and historical data for sparkline

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: string;
  sparkline: number[]; // 10 data points for mini bar chart
}

export interface StockError {
  error: true;
  reason: 'private' | 'not_found' | 'api_error';
}

export type StockResult = StockQuote | StockError;

// Fetch current quote
async function fetchQuote(symbol: string): Promise<StockQuote | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return null;

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const data = await res.json();

  const q = data?.['Global Quote'];
  console.log('[alphaVantage] quote keys:', Object.keys(q ?? {}), '| note:', data?.Note ?? data?.Information ?? 'none');
  if (!q || !q['05. price']) return null;

  const price = parseFloat(q['05. price']);
  const change = parseFloat(q['09. change']);
  const changePercent = parseFloat(q['10. change percent']?.replace('%', '') ?? '0');

  return {
    symbol,
    price,
    change,
    changePercent,
    high: parseFloat(q['03. high']),
    low: parseFloat(q['04. low']),
    volume: parseInt(q['06. volume']).toLocaleString(),
    sparkline: [], // populated separately
  };
}

// Fetch 10-day daily close prices for sparkline
async function fetchSparkline(symbol: string): Promise<number[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const data = await res.json();

  const series = data?.['Time Series (Daily)'];
  if (!series) return [];

  const closes = Object.values(series)
    .slice(0, 10)
    .reverse()
    .map((d: unknown) => parseFloat((d as Record<string, string>)['4. close']));

  return closes;
}

// Main export: get full stock data using a pre-resolved ticker from Claude
export async function getStockData(ticker: string | null, isPublic: boolean): Promise<StockResult> {
  if (!isPublic || !ticker) return { error: true, reason: 'private' };

  try {
    const symbol = ticker;

    const [quote, sparkline] = await Promise.all([
      fetchQuote(symbol),
      fetchSparkline(symbol),
    ]);

    if (!quote) return { error: true, reason: 'api_error' };

    return { ...quote, sparkline };
  } catch {
    return { error: true, reason: 'api_error' };
  }
}

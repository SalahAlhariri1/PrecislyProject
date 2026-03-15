// NewsAPI integration
// Primary: /everything with tight quoted-phrase query + excludeDomains
// Fallback: /top-headlines with category=business if everything returns 0 results

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface NewsResult {
  articles: NewsArticle[];
  error?: string;
}

const EXCLUDE_DOMAINS = 'az-dental.com,pypi.org';

// Simple keyword-based sentiment analysis
function inferSentiment(title: string, description: string = ''): 'positive' | 'negative' | 'neutral' {
  const text = (title + ' ' + description).toLowerCase();

  const positiveWords = [
    'growth', 'profit', 'record', 'surge', 'beat', 'exceeds', 'launch', 'expands',
    'partnership', 'deal', 'award', 'rises', 'gains', 'strong', 'success', 'wins',
    'new', 'innovation', 'milestone', 'revenue', 'upgrade', 'raises', 'bullish',
  ];
  const negativeWords = [
    'loss', 'decline', 'drop', 'falls', 'cut', 'layoff', 'miss', 'below', 'down',
    'risk', 'concern', 'warning', 'lawsuit', 'fraud', 'probe', 'fail', 'slump',
    'crash', 'sell', 'downgrade', 'debt', 'crisis', 'bearish', 'recall', 'fine',
  ];

  const pos = positiveWords.filter(w => text.includes(w)).length;
  const neg = negativeWords.filter(w => text.includes(w)).length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

// Format relative date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7)  return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Map raw NewsAPI article to our shape
function mapArticle(a: {
  title: string;
  source: { name: string };
  url: string;
  publishedAt: string;
  description?: string;
}): NewsArticle {
  return {
    title: a.title,
    source: a.source?.name ?? 'Unknown',
    url: a.url,
    publishedAt: formatDate(a.publishedAt),
    sentiment: inferSentiment(a.title, a.description),
  };
}

// Build quoted-phrase query: "Apple Inc" OR "AAPL" OR "$AAPL"
function buildQuery(companyName: string, ticker: string | null): string {
  const parts = [`"${companyName}"`];
  if (ticker) {
    parts.push(`"${ticker}"`);
    parts.push(`"$${ticker}"`);
  }
  return parts.join(' OR ');
}

// Main export: fetch recent business news for a company
export async function getCompanyNews(companyName: string, ticker?: string | null): Promise<NewsResult> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return { articles: [], error: 'NEWS_API_KEY not configured' };

  const headers = { 'User-Agent': 'Mozilla/5.0' };
  const q = buildQuery(companyName, ticker ?? null);

  // --- Primary: /everything with tight quoted query ---
  try {
    const from = new Date();
    from.setDate(from.getDate() - 28);
    const fromDate = from.toISOString().split('T')[0];

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&from=${fromDate}&sortBy=publishedAt&pageSize=6&language=en&excludeDomains=${EXCLUDE_DOMAINS}&apiKey=${apiKey}`;
    const res  = await fetch(url, { next: { revalidate: 0 }, headers });
    const data = await res.json();

    console.log('[newsApi/everything] status:', data.status, '| total:', data.totalResults, '| q:', q);

    if (data.status === 'ok' && data.totalResults > 0) {
      const articles = (data.articles ?? [])
        .filter((a: { title?: string }) => a.title && a.title !== '[Removed]')
        .slice(0, 4)
        .map(mapArticle);
      return { articles };
    }
  } catch {
    // fall through to backup
  }

  // --- Fallback: /top-headlines with category=business ---
  try {
    const url = `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(companyName)}&category=business&language=en&country=us&pageSize=6&apiKey=${apiKey}`;
    const res  = await fetch(url, { next: { revalidate: 0 }, headers });
    const data = await res.json();

    console.log('[newsApi/top-headlines] status:', data.status, '| total:', data.totalResults);

    if (data.status === 'ok') {
      const articles = (data.articles ?? [])
        .filter((a: { title?: string }) => a.title && a.title !== '[Removed]')
        .slice(0, 4)
        .map(mapArticle);
      return { articles };
    }

    return { articles: [], error: data.message ?? 'NewsAPI error' };
  } catch {
    return { articles: [], error: 'Failed to fetch news' };
  }
}

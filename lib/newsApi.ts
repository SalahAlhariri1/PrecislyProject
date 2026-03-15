// NewsAPI integration
// Fetches recent news articles for a company and infers sentiment

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

  const posCount = positiveWords.filter(w => text.includes(w)).length;
  const negCount = negativeWords.filter(w => text.includes(w)).length;

  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

// Format relative date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Main export: fetch recent news for a company
export async function getCompanyNews(companyName: string): Promise<NewsResult> {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return { articles: [], error: 'NEWS_API_KEY not configured' };
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 28);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(companyName)}&from=${fromDate}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${apiKey}`;

    const res = await fetch(url, {
      next: { revalidate: 0 },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = await res.json();

    console.log('[newsApi] status:', data.status, '| code:', data.code, '| message:', data.message, '| totalResults:', data.totalResults);

    if (data.status !== 'ok') {
      return { articles: [], error: data.message ?? 'NewsAPI error' };
    }

    const articles: NewsArticle[] = (data.articles ?? [])
      .filter((a: { title?: string }) => a.title && a.title !== '[Removed]')
      .slice(0, 4)
      .map((a: { title: string; source: { name: string }; url: string; publishedAt: string; description?: string }) => ({
        title: a.title,
        source: a.source?.name ?? 'Unknown',
        url: a.url,
        publishedAt: formatDate(a.publishedAt),
        sentiment: inferSentiment(a.title, a.description),
      }));

    return { articles };
  } catch {
    return { articles: [], error: 'Failed to fetch news' };
  }
}

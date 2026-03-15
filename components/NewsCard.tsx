// NewsCard — recent news with sentiment badges

interface NewsArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface NewsCardProps {
  articles: NewsArticle[];
  error?: string;
}

const SENTIMENT_STYLES: Record<string, { background: string; color: string; border: string; label: string }> = {
  positive: { background: '#f0fdf4', color: '#16a34a', border: '#d1fae5', label: 'POS' },
  negative: { background: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'NEG' },
  neutral:  { background: '#fafaf9', color: '#888888', border: '#e8e8e4', label: 'NEU' },
};

export default function NewsCard({ articles, error }: NewsCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e8e8e4',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          recent news
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          newsapi · last 30 days
        </span>
      </div>

      {/* No news */}
      {(error || articles.length === 0) && (
        <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#cccccc' }}>
          no recent news found
        </p>
      )}

      {/* Articles */}
      {articles.map((article, i) => {
        const sty = SENTIMENT_STYLES[article.sentiment];
        const isLast = i === articles.length - 1;

        return (
          <div
            key={i}
            style={{
              borderBottom: isLast ? 'none' : '1px solid #f5f5f3',
              padding: '10px 0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              {/* Headline */}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-geist)',
                  fontSize: '12px',
                  color: '#1a1a1a',
                  textDecoration: 'none',
                  lineHeight: '1.5',
                  flex: 1,
                }}
              >
                {article.title}
              </a>

              {/* Sentiment badge */}
              <span
                style={{
                  fontFamily: 'var(--font-geist-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.1em',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: sty.background,
                  color: sty.color,
                  border: `1px solid ${sty.border}`,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {sty.label}
              </span>
            </div>

            {/* Source + date */}
            <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc' }}>
                {article.source}
              </span>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#e0e0dc' }}>·</span>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc' }}>
                {article.publishedAt}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

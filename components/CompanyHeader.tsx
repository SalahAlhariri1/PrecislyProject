// CompanyHeader — shown after generation: company name, tags, fetched time + LIVE indicator

interface CompanyHeaderProps {
  company: string;
  fetchedAt: string;
  ticker?: string | null;
  snapshot: {
    description?: string;
    employees?: string;
  };
}

// Extract rough industry/tag from description
function getTag(description: string = ''): string {
  const lower = description.toLowerCase();
  if (lower.includes('software') || lower.includes('saas') || lower.includes('cloud')) return 'SOFTWARE';
  if (lower.includes('fintech') || lower.includes('financial')) return 'FINTECH';
  if (lower.includes('biotech') || lower.includes('pharma') || lower.includes('health')) return 'HEALTHTECH';
  if (lower.includes('ecommerce') || lower.includes('retail')) return 'ECOMMERCE';
  if (lower.includes('ai') || lower.includes('artificial intelligence')) return 'AI/ML';
  if (lower.includes('hardware') || lower.includes('semiconductor')) return 'HARDWARE';
  return 'TECHNOLOGY';
}

function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-geist-mono)',
        fontSize: '10px',
        letterSpacing: '0.1em',
        padding: '2px 8px',
        borderRadius: '4px',
        border: '1px solid #e8e8e4',
        color: '#888888',
        background: '#fafaf9',
      }}
    >
      {label}
    </span>
  );
}

export default function CompanyHeader({ company, fetchedAt, ticker, snapshot }: CompanyHeaderProps) {
  const tag = getTag(snapshot.description);

  // Parse UTC time from fetchedAt string
  const timeMatch = fetchedAt.match(/(\d{2}:\d{2}:\d{2})/);
  const timeStr = timeMatch ? timeMatch[1] : '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0ec',
        paddingBottom: '16px',
        marginBottom: '20px',
      }}
    >
      {/* Left: company name + tags */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-geist)',
            fontSize: '22px',
            fontWeight: 500,
            letterSpacing: '-0.03em',
            color: '#1a1a1a',
            margin: '0 0 10px 0',
          }}
        >
          {company}
        </h1>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {ticker && <Tag label={ticker} />}
          <Tag label={tag} />
          {snapshot.employees && <Tag label={snapshot.employees + ' EMP'} />}
        </div>
      </div>

      {/* Right: fetched time + LIVE badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
        {timeStr && (
          <span
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: '10px',
              color: '#cccccc',
              letterSpacing: '0.05em',
            }}
          >
            fetched {timeStr} UTC
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: '10px',
            letterSpacing: '0.1em',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid #d1fae5',
            background: '#f0fdf4',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <span className="live-dot" />
          LIVE
        </span>
      </div>
    </div>
  );
}

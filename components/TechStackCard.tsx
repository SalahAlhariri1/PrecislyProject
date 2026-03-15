// TechStackCard — inferred tech stack as code-snippet-style tags

interface TechStackCardProps {
  likely: string[];
  source: string;
}

export default function TechStackCard({ likely, source }: TechStackCardProps) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          likely tech stack
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          inferred
        </span>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {likely.map((tech, i) => (
          <span
            key={i}
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: '11px',
              color: '#1a1a1a',
              background: '#f5f5f3',
              border: '1px solid #e8e8e4',
              padding: '3px 8px',
              borderRadius: '4px',
              display: 'inline-flex',
            }}
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Source line */}
      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc' }}>
        {source}
      </div>
    </div>
  );
}

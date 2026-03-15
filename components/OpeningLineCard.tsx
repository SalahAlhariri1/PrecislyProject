// OpeningLineCard — the money card: one researched sentence to open a call

interface OpeningLineCardProps {
  line: string;
}

export default function OpeningLineCard({ line }: OpeningLineCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e8e8e4',
        borderRadius: '8px',
        padding: '24px',
      }}
    >
      {/* Card header */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaaaaa', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          say this first
        </span>
      </div>

      {/* The line */}
      <p
        style={{
          fontFamily: 'var(--font-geist)',
          fontSize: '16px',
          color: '#1a1a1a',
          lineHeight: 1.6,
          margin: 0,
          borderLeft: '3px solid #1a1a1a',
          paddingLeft: '16px',
        }}
      >
        &ldquo;{line}&rdquo;
      </p>
    </div>
  );
}

// RedFlagsCard — deal-killing risks with red dot indicators

interface RedFlagsCardProps {
  flags: string[];
}

export default function RedFlagsCard({ flags }: RedFlagsCardProps) {
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
          red flags
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          risk analysis
        </span>
      </div>

      {/* No flags detected */}
      {flags.length === 0 && (
        <span
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: '10px',
            letterSpacing: '0.1em',
            padding: '3px 10px',
            borderRadius: '4px',
            border: '1px solid #d1fae5',
            background: '#f0fdf4',
            color: '#16a34a',
          }}
        >
          [ NO FLAGS DETECTED ]
        </span>
      )}

      {/* Flag items */}
      {flags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {flags.map((flag, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#dc2626',
                  flexShrink: 0,
                  marginTop: '5px',
                }}
              />
              <span style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#555', lineHeight: 1.5 }}>
                {flag}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

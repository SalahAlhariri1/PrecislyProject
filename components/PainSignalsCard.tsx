// PainSignalsCard — 3 pain signals with orange dot indicators

interface PainSignal {
  signal: string;
  why: string;
}

interface PainSignalsCardProps {
  signals: PainSignal[];
}

export default function PainSignalsCard({ signals }: PainSignalsCardProps) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          pain signals
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          detected
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {signals.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            {/* Orange square */}
            <span
              style={{
                width: '4px',
                height: '4px',
                background: '#f97316',
                flexShrink: 0,
                marginTop: '7px',
              }}
            />
            <div>
              <div style={{ fontFamily: 'var(--font-geist)', fontSize: '13px', color: '#1a1a1a', lineHeight: 1.5 }}>
                {s.signal}
              </div>
              <div style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#888888', fontStyle: 'italic', marginTop: '4px', lineHeight: 1.5 }}>
                {s.why}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

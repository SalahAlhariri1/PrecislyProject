// TalkingPointsCard — Claude-generated SE talking points numbered 01 02 03

interface TalkingPointsCardProps {
  points: [string, string, string];
}

export default function TalkingPointsCard({ points }: TalkingPointsCardProps) {
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
          talking points
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          claude-3.5
        </span>
      </div>

      {/* Points */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {points.map((point, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '14px',
              alignItems: 'flex-start',
            }}
          >
            {/* Number */}
            <span
              style={{
                fontFamily: 'var(--font-geist-mono)',
                fontSize: '12px',
                color: '#cccccc',
                flexShrink: 0,
                paddingTop: '1px',
                minWidth: '20px',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            {/* Text */}
            <p
              style={{
                fontFamily: 'var(--font-geist)',
                fontSize: '12px',
                color: '#555',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {point}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

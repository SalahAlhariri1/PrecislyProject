// ObjectionsCard — technical objections with confidence badges (shared across all call types)

interface Objection {
  objection: string;
  counter: string;
  confidence: 'HIGH' | 'MED' | 'LOW';
}

interface ObjectionsCardProps {
  objections: Objection[];
}

const CONF_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  HIGH: { bg: '#f0fdf4', color: '#16a34a', border: '#d1fae5' },
  MED:  { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  LOW:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

export default function ObjectionsCard({ objections }: ObjectionsCardProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          // expect these
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          agent-generated
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {objections.map((obj, i) => {
          const conf = CONF_STYLES[obj.confidence] ?? CONF_STYLES.MED;
          return (
            <div key={i} style={{ borderBottom: i < objections.length - 1 ? '1px solid #f5f5f3' : 'none', paddingBottom: i < objections.length - 1 ? '16px' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <p style={{ fontFamily: 'var(--font-geist)', fontSize: '13px', color: '#1a1a1a', fontStyle: 'italic', margin: 0, lineHeight: 1.5, flex: 1 }}>
                  &ldquo;{obj.objection}&rdquo;
                </p>
                <span style={{
                  fontFamily: 'var(--font-geist-mono)', fontSize: '9px', letterSpacing: '0.1em',
                  padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                  background: conf.bg, color: conf.color, border: `1px solid ${conf.border}`,
                }}>
                  {obj.confidence}
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#555', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                {obj.counter}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

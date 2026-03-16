// DiscoveryAgendaCard — 5-point discovery call agenda

interface AgendaItem {
  item: string;
  question: string;
  why: string;
}

interface DiscoveryAgendaCardProps {
  agenda: AgendaItem[];
}

export default function DiscoveryAgendaCard({ agenda }: DiscoveryAgendaCardProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {'// discovery call'}
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          agent-generated
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {agenda.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <span style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: '#cccccc',
              flexShrink: 0, paddingTop: '2px', minWidth: '20px',
            }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p style={{ fontFamily: 'var(--font-geist)', fontSize: '13px', color: '#1a1a1a', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
                {a.item}
              </p>
              <p style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#888', fontStyle: 'italic', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                {a.question}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// DemoScriptCard — 5-act demo flow with what to show, say, and which pain it addresses

interface DemoAct {
  act: string;
  whatToShow: string;
  whatToSay: string;
  addresses: string;
}

interface DemoScriptCardProps {
  script: DemoAct[];
}

export default function DemoScriptCard({ script }: DemoScriptCardProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {'// demo flow'}
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          agent-generated
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {script.map((act, i) => (
          <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <span style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: '#cccccc',
              flexShrink: 0, paddingTop: '2px', minWidth: '20px',
            }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p style={{ fontFamily: 'var(--font-geist)', fontSize: '13px', color: '#1a1a1a', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
                {act.act}
              </p>
              <p style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#555', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                {act.whatToShow}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

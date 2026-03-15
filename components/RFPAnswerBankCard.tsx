// RFPAnswerBankCard — 8 common RFP questions with pre-drafted answers + tailor notes

interface RFPAnswer {
  question: string;
  answer: string;
  tailor: string;
}

interface RFPAnswerBankCardProps {
  answers: RFPAnswer[];
}

export default function RFPAnswerBankCard({ answers }: RFPAnswerBankCardProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {'// rfp prep'}
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          agent-generated
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {answers.map((a, i) => (
          <div key={i} style={{ borderBottom: i < answers.length - 1 ? '1px solid #f5f5f3' : 'none', paddingBottom: i < answers.length - 1 ? '18px' : 0 }}>
            <p style={{ fontFamily: 'var(--font-geist)', fontSize: '13px', color: '#1a1a1a', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
              {a.question}
            </p>
            <p style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#555', margin: '6px 0 0 0', lineHeight: 1.6 }}>
              {a.answer}
            </p>
            <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaaaaa', margin: '4px 0 0 0', lineHeight: 1.5 }}>
              TAILOR → {a.tailor}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

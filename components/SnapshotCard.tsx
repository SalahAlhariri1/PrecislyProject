// SnapshotCard — company fundamentals in stat-row layout

interface SnapshotCardProps {
  snapshot: {
    revenue: string;
    marketCap: string;
    growth: string;
    ceo: string;
    founded: string;
    employees: string;
  };
}

function StatRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '7px 0',
        borderBottom: last ? 'none' : '1px solid #f5f5f3',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-geist)',
          fontSize: '12px',
          color: '#999',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '12px',
          color: '#1a1a1a',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function SnapshotCard({ snapshot }: SnapshotCardProps) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          snapshot
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          compiled
        </span>
      </div>

      <StatRow label="Revenue" value={snapshot.revenue} />
      <StatRow label="Market cap" value={snapshot.marketCap} />
      <StatRow label="YoY growth" value={snapshot.growth} />
      <StatRow label="CEO" value={snapshot.ceo} />
      <StatRow label="Founded" value={snapshot.founded} last />
    </div>
  );
}

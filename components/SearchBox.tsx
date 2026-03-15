// SearchBox — the main input bar with prefix + generate button

'use client';

interface SearchBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function SearchBox({ value, onChange, onSubmit, loading }: SearchBoxProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) onSubmit();
  };

  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid #e2e2de',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Left prefix */}
      <div
        style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '11px',
          color: '#bbbbbb',
          padding: '0 12px',
          borderRight: '1px solid #f0f0ec',
          background: '#fafaf9',
          display: 'flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        target →
      </div>

      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Company name or domain..."
        disabled={loading}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '13px',
          color: '#1a1a1a',
          padding: '12px 14px',
          background: 'transparent',
        }}
      />

      {/* Generate button */}
      <button
        onClick={onSubmit}
        disabled={loading || !value.trim()}
        style={{
          background: loading ? '#555' : '#1a1a1a',
          color: '#fff',
          border: 'none',
          borderLeft: '1px solid #f0f0ec',
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          padding: '0 20px',
          cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'background 0.15s',
        }}
      >
        {loading ? 'GENERATING...' : 'GENERATE'}
      </button>
    </div>
  );
}

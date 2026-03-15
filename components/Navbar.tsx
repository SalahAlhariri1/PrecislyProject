// Navbar — fixed top bar with brand + model/live badges

export default function Navbar() {
  return (
    <nav
      style={{
        borderBottom: '1px solid #e8e8e4',
        background: '#fafaf9',
        padding: '0 24px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>
        brief<span style={{ color: '#f97316' }}>.</span>dev
      </span>

      {/* Right badges */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: '10px',
            color: '#888888',
            letterSpacing: '0.1em',
            border: '1px solid #e8e8e4',
            borderRadius: '4px',
            padding: '2px 8px',
            background: '#fff',
          }}
        >
          [ CLAUDE-4.6 ]
        </span>

        <span
          style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: '10px',
            color: '#888888',
            letterSpacing: '0.1em',
            border: '1px solid #e8e8e4',
            borderRadius: '4px',
            padding: '2px 8px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span className="live-dot" />
          [ LIVE ]
        </span>
      </div>
    </nav>
  );
}

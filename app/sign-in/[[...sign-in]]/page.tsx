import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600, fontSize: '20px', color: '#e8e8e8' }}>
          brief<span style={{ color: '#f97316' }}>.</span>dev
        </span>
        <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#555', marginTop: '6px' }}>
          pre-call intelligence for sales engineers
        </p>
      </div>
      <SignIn />
    </div>
  );
}

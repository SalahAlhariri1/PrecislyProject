'use client';

import { useState, useEffect } from 'react';
import { UserButton, useUser } from '@clerk/nextjs';

const LS_KEY = 'se_config';

export interface SEProfile {
  name: string;
  company: string;
  product: string;
  whatItDoes: string;
  strengths: string;
  weaknesses: string;
  typicalBuyer: string;
}

export interface CallConfig {
  prospect: string;
  callType: 'discovery' | 'demo' | 'rfp';
  notes: string;
}

export interface BriefSummary {
  id: string;
  prospect: string;
  call_type: string;
  created_at: string;
  cards: Record<string, unknown>;
}

interface SidebarProps {
  onRun: (profile: SEProfile, call: CallConfig) => void;
  onRestoreBrief: (brief: BriefSummary) => void;
  loading: boolean;
  briefRefreshKey?: number;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-geist-mono)',
  fontSize: '11px',
  color: '#d4d4d4',
  border: '1px solid #2a2a2a',
  borderRadius: '4px',
  padding: '8px 10px',
  background: '#1a1a1a',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono)',
  fontSize: '10px',
  color: '#555555',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: '4px',
};

const DEFAULT_PROFILE: SEProfile = {
  name: '', company: '', product: '', whatItDoes: '', strengths: '', weaknesses: '', typicalBuyer: '',
};

function mapDbProfile(data: Record<string, string>): SEProfile {
  return {
    name: data.name ?? '',
    company: data.company ?? '',
    product: data.product ?? '',
    whatItDoes: data.what_it_does ?? '',
    strengths: data.strengths ?? '',
    weaknesses: data.weaknesses ?? '',
    typicalBuyer: data.typical_buyer ?? '',
  };
}

export default function Sidebar({ onRun, onRestoreBrief, loading, briefRefreshKey }: SidebarProps) {
  const { isSignedIn } = useUser();
  const [profile, setProfile] = useState<SEProfile>(DEFAULT_PROFILE);
  const [call, setCall] = useState<CallConfig>({ prospect: '', callType: 'discovery', notes: '' });
  const [profileOpen, setProfileOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [briefHistory, setBriefHistory] = useState<BriefSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Load profile: from API if signed in, else from localStorage
  useEffect(() => {
    if (isSignedIn) {
      fetch('/api/profile')
        .then(r => r.json())
        .then(({ profile: dbProfile }) => {
          if (dbProfile) setProfile(mapDbProfile(dbProfile));
        })
        .catch(() => { /* fallback to localStorage below */ });
    } else {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) setProfile(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, [isSignedIn]);

  // Load brief history when signed in (re-fetches whenever briefRefreshKey changes)
  useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/briefs')
      .then(r => r.json())
      .then(({ briefs }) => { if (briefs) setBriefHistory(briefs); })
      .catch(() => { /* non-fatal */ });
  }, [isSignedIn, briefRefreshKey]);

  const handleSave = async () => {
    localStorage.setItem(LS_KEY, JSON.stringify(profile));
    if (isSignedIn) {
      try {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        });
      } catch { /* non-fatal */ }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRun = () => {
    if (!call.prospect.trim() || loading) return;
    onRun(profile, call);
  };

  const updateProfile = (key: keyof SEProfile, value: string) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <aside
      style={{
        width: '280px',
        minWidth: '280px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#111111',
        borderRight: '1px solid #222222',
        padding: '24px 20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Brand + UserButton */}
      <div style={{
        marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid #222222',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600, fontSize: '14px', color: '#e8e8e8' }}>
            brief<span style={{ color: '#f97316' }}>.</span>dev
          </span>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#444444', marginLeft: '8px', letterSpacing: '0.05em' }}>
            agent
          </span>
        </div>
        {isSignedIn && (
          <UserButton
            appearance={{
              elements: {
                avatarBox: { width: '24px', height: '24px' },
              },
            }}
          />
        )}
      </div>

      {/* ── Section 1: YOUR PRODUCT ────────────── */}
      <div style={{ marginBottom: '0' }}>
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#555555',
            letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px 0',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <span style={{ fontSize: '8px', transform: profileOpen ? 'rotate(90deg)' : 'none', transition: '0.15s' }}>▶</span>
          {'// your product'}
        </button>

        {profileOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={labelStyle}>your name</label>
              <input style={inputStyle} placeholder="Alex Chen" value={profile.name}
                onChange={e => updateProfile('name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>your company</label>
              <input style={inputStyle} placeholder="Acme Corp" value={profile.company}
                onChange={e => updateProfile('company', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>your product</label>
              <input style={inputStyle} placeholder="DataSync Pro" value={profile.product}
                onChange={e => updateProfile('product', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>what it does</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3}
                placeholder="One sentence: what problem does it solve?"
                value={profile.whatItDoes} onChange={e => updateProfile('whatItDoes', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>core strengths</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3}
                placeholder="3 strengths, one per line"
                value={profile.strengths} onChange={e => updateProfile('strengths', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>known weaknesses</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2}
                placeholder="Be honest — 1-2 weaknesses"
                value={profile.weaknesses} onChange={e => updateProfile('weaknesses', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>typical buyer title</label>
              <input style={inputStyle} placeholder="VP of Engineering" value={profile.typicalBuyer}
                onChange={e => updateProfile('typicalBuyer', e.target.value)} />
            </div>

            <button
              onClick={handleSave}
              type="button"
              style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: '10px', letterSpacing: '0.1em',
                width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid',
                borderColor: saved ? '#16a34a' : '#2a2a2a',
                cursor: 'pointer',
                background: 'transparent',
                color: saved ? '#16a34a' : '#555555',
                transition: 'all 0.15s',
              }}
            >
              {saved ? '[ PROFILE SAVED ✓ ]' : '[ SAVE PROFILE ]'}
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #222222', margin: '20px 0' }} />

      {/* ── Section 2: THIS CALL ───────────────── */}
      <div>
        <p style={{
          fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#555555',
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px 0',
        }}>
          {'// this call'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={labelStyle}>prospect company</label>
            <input style={inputStyle} placeholder="Salesforce" value={call.prospect}
              onChange={e => setCall(prev => ({ ...prev, prospect: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>call type</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto', colorScheme: 'dark' }}
              value={call.callType}
              onChange={e => setCall(prev => ({ ...prev, callType: e.target.value as CallConfig['callType'] }))}
            >
              <option value="discovery">Discovery Call</option>
              <option value="demo">Product Demo</option>
              <option value="rfp">RFP Response</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>your notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3}
              placeholder="Anything you already know about this account..."
              value={call.notes} onChange={e => setCall(prev => ({ ...prev, notes: e.target.value }))} />
          </div>

          <button
            onClick={handleRun}
            type="button"
            style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: '11px', letterSpacing: '0.1em',
              width: '100%', padding: '12px', borderRadius: '4px', border: 'none',
              background: loading ? '#2a1a08' : '#f97316',
              color: loading ? '#f97316' : '#000000',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? '[ RUNNING... ]' : '[ RUN AGENT ]'}
          </button>
        </div>
      </div>

      {/* ── Section 3: BRIEF HISTORY ──────────── */}
      {isSignedIn && briefHistory.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid #222222', margin: '20px 0' }} />
          <div>
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#555555',
                letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px 0',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <span style={{ fontSize: '8px', transform: historyOpen ? 'rotate(90deg)' : 'none', transition: '0.15s' }}>▶</span>
              {'// recent briefs'}
            </button>

            {historyOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {briefHistory.slice(0, 10).map(brief => (
                  <button
                    key={brief.id}
                    onClick={() => onRestoreBrief(brief)}
                    style={{
                      fontFamily: 'var(--font-geist-mono)',
                      fontSize: '10px',
                      color: '#888888',
                      background: 'none',
                      border: '1px solid #222222',
                      borderRadius: '3px',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'border-color 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#444444')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#222222')}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {brief.prospect}
                    </span>
                    <span style={{ color: '#444444', whiteSpace: 'nowrap', fontSize: '9px' }}>
                      {brief.call_type.toUpperCase()} · {formatDate(brief.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

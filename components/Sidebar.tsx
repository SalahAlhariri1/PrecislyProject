'use client';

import { useState, useEffect } from 'react';

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

interface SidebarProps {
  onRun: (profile: SEProfile, call: CallConfig) => void;
  loading: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-geist-mono)',
  fontSize: '11px',
  color: '#1a1a1a',
  border: '1px solid #e8e8e4',
  borderRadius: '4px',
  padding: '8px 10px',
  background: '#fafaf9',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono)',
  fontSize: '10px',
  color: '#999999',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: '4px',
};

const DEFAULT_PROFILE: SEProfile = {
  name: '', company: '', product: '', whatItDoes: '', strengths: '', weaknesses: '', typicalBuyer: '',
};

export default function Sidebar({ onRun, loading }: SidebarProps) {
  const [profile, setProfile] = useState<SEProfile>(DEFAULT_PROFILE);
  const [call, setCall] = useState<CallConfig>({ prospect: '', callType: 'discovery', notes: '' });
  const [profileOpen, setProfileOpen] = useState(true);
  const [saved, setSaved] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const handleSave = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(profile));
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

  return (
    <aside
      style={{
        width: '280px',
        minWidth: '280px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#ffffff',
        borderRight: '1px solid #e8e8e4',
        padding: '24px 20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Brand */}
      <div style={{ marginBottom: '24px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>
          brief<span style={{ color: '#f97316' }}>.</span>dev
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', marginLeft: '8px', letterSpacing: '0.05em' }}>
          agent
        </span>
      </div>

      {/* ── Section 1: YOUR PRODUCT ────────────── */}
      <div style={{ marginBottom: '0' }}>
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaaaaa',
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
                width: '100%', padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: saved ? '#16a34a' : '#1a1a1a', color: '#fff', transition: 'background 0.15s',
              }}
            >
              {saved ? '[ PROFILE SAVED ✓ ]' : '[ SAVE PROFILE ]'}
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #f0f0ec', margin: '20px 0' }} />

      {/* ── Section 2: THIS CALL ───────────────── */}
      <div>
        <p style={{
          fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaaaaa',
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
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
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
              width: '100%', padding: '12px', borderRadius: '6px', border: 'none',
              background: loading ? '#555' : '#1a1a1a', color: '#fff',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? '[ RUNNING... ]' : '[ RUN AGENT ]'}
          </button>
        </div>
      </div>
    </aside>
  );
}

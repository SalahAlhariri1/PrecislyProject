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

export interface MeetingTrigger {
  id: string;
  company_name: string;
  call_type: string;
  meeting_time: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  brief_id: string | null;
  briefs: { cards: Record<string, unknown> } | null;
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
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [meetings, setMeetings] = useState<MeetingTrigger[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(true);

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

  // Load calendar meetings when signed in
  useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/calendar/meetings')
      .then(r => r.json())
      .then(({ connected, meetings: m }) => {
        setCalendarConnected(!!connected);
        if (m) setMeetings(m);
      })
      .catch(() => { /* non-fatal */ });
  }, [isSignedIn]);

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

  const formatMeetingTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today ${timeStr}`;
    if (isTomorrow) return `Tomorrow ${timeStr}`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${timeStr}`;
  };

  const handleMeetingClick = (meeting: MeetingTrigger) => {
    if (meeting.status === 'complete' && meeting.briefs?.cards) {
      onRestoreBrief({
        id: meeting.brief_id!,
        prospect: meeting.company_name,
        call_type: meeting.call_type,
        created_at: meeting.meeting_time,
        cards: meeting.briefs.cards,
      });
    } else if (meeting.status === 'pending' || meeting.status === 'failed') {
      setCall(prev => ({ ...prev, prospect: meeting.company_name, callType: meeting.call_type as CallConfig['callType'] }));
      onRun(profile, { prospect: meeting.company_name, callType: meeting.call_type as CallConfig['callType'], notes: '' });
    }
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

      {/* ── Section 3: CALENDAR ───────────────── */}
      {isSignedIn && (
        <>
          <div style={{ borderTop: '1px solid #222222', margin: '20px 0' }} />
          <div>
            <button
              onClick={() => setCalendarOpen(!calendarOpen)}
              style={{
                fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#555555',
                letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px 0',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <span style={{ fontSize: '8px', transform: calendarOpen ? 'rotate(90deg)' : 'none', transition: '0.15s' }}>▶</span>
              {'// calendar'}
            </button>

            {calendarOpen && (
              <div>
                {!calendarConnected ? (
                  <a
                    href="/api/auth/google/connect"
                    style={{
                      display: 'block', textAlign: 'center',
                      fontFamily: 'var(--font-geist-mono)', fontSize: '10px', letterSpacing: '0.08em',
                      padding: '9px 12px', borderRadius: '4px',
                      border: '1px solid #2a2a2a', color: '#888888',
                      textDecoration: 'none', transition: 'border-color 0.1s, color 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#ccc'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#888888'; }}
                  >
                    [ CONNECT GOOGLE CALENDAR ]
                  </a>
                ) : meetings.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#444', margin: 0 }}>
                    No upcoming meetings found
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {meetings.map(meeting => {
                      const isReady = meeting.status === 'complete';
                      const isRunning = meeting.status === 'running';
                      const isFailed = meeting.status === 'failed';
                      return (
                        <button
                          key={meeting.id}
                          onClick={() => !isRunning && handleMeetingClick(meeting)}
                          disabled={isRunning || loading}
                          style={{
                            fontFamily: 'var(--font-geist-mono)', fontSize: '10px',
                            color: isReady ? '#d4d4d4' : '#888888',
                            background: 'none',
                            border: `1px solid ${isReady ? '#333' : '#222222'}`,
                            borderRadius: '3px', padding: '7px 8px',
                            cursor: isRunning || loading ? 'not-allowed' : 'pointer',
                            textAlign: 'left', width: '100%',
                            transition: 'border-color 0.1s',
                          }}
                          onMouseEnter={e => { if (!isRunning && !loading) e.currentTarget.style.borderColor = '#444'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = isReady ? '#333' : '#222222'; }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {meeting.company_name}
                            </span>
                            <span style={{
                              fontSize: '8px', whiteSpace: 'nowrap', padding: '1px 5px',
                              borderRadius: '3px',
                              background: isReady ? '#14532d' : isRunning ? '#1c1917' : isFailed ? '#450a0a' : '#1c1917',
                              color: isReady ? '#4ade80' : isRunning ? '#f97316' : isFailed ? '#f87171' : '#888',
                            }}>
                              {isReady ? 'READY' : isRunning ? '...' : isFailed ? 'RETRY' : 'PREP'}
                            </span>
                          </div>
                          <div style={{ color: '#555', fontSize: '9px', marginTop: '3px' }}>
                            {meeting.call_type.toUpperCase()} · {formatMeetingTime(meeting.meeting_time)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Section 4: BRIEF HISTORY ──────────── */}
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

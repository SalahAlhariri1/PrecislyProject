'use client';

// brief.dev — SE Agent
// Split layout: sidebar (product config + call setup) | main (agent thinking + brief cards)

import { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import type { SEProfile, CallConfig } from '@/components/Sidebar';
import AgentThinkingPanel from '@/components/AgentThinkingPanel';
import type { AgentLog } from '@/components/AgentThinkingPanel';

// ─── Types ──────────────────────────────────────────────

type AgentState = 'idle' | 'running' | 'complete' | 'error';

interface BriefOutput {
  openingLine?: string;
  agenda?: { item: string; question: string; why: string }[];
  demoScript?: { act: string; whatToShow: string; whatToSay: string; addresses: string }[];
  answerBank?: { question: string; answer: string; tailor: string }[];
  objections?: { objection: string; counter: string; confidence: 'HIGH' | 'MED' | 'LOW' }[];
  followUpEmail?: { subject: string; body: string };
}

interface SnapshotData {
  revenue: string;
  marketCap: string;
  growth: string;
  ceo: string;
  founded: string;
  employees: string;
  description: string;
}

interface CompanyIntel {
  snapshot?: SnapshotData | string;
  painSignals?: string[];
  techStack?: string[];
  recentDevelopments?: string[];
  jobPostingInsights?: string[];
  competitiveLandscape?: string;
}

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: string;
  sparkline: number[];
}

// ─── Helpers ────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0 12px' }}>
      <span style={{
        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#cccccc',
        letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: '#f0f0ec' }} />
    </div>
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^- \[ \]/gm, '•')
    .replace(/^- /gm, '• ')
    .replace(/\*(.+?)\*/g, '$1');
}

const CONF_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  HIGH: { bg: '#f0fdf4', color: '#16a34a', border: '#d1fae5' },
  MED: { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' },
  LOW: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

// ─── Main ───────────────────────────────────────────────

export default function Home() {
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [brief, setBrief] = useState<BriefOutput | null>(null);
  const [companyIntel, setCompanyIntel] = useState<CompanyIntel | null>(null);
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [stockError, setStockError] = useState<{ error: true; reason: string } | null>(null);
  const [callType, setCallType] = useState<'discovery' | 'demo' | 'rfp'>('discovery');
  const [prospect, setProspect] = useState('');
  const [sourceCount, setSourceCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalElapsed = useRef(0);

  // Timer effect
  useEffect(() => {
    if (agentState === 'running') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (agentState === 'complete') finalElapsed.current = elapsed;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentState]);

  const handleRun = useCallback(async (profile: SEProfile, call: CallConfig) => {
    if (agentState === 'running') return;

    setAgentState('running');
    setAgentLogs([]);
    setError(null);
    setBrief(null);
    setCompanyIntel(null);
    setStockData(null);
    setStockError(null);
    setCallType(call.callType);
    setProspect(call.prospect);
    setSourceCount(0);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect: call.prospect,
          callType: call.callType,
          seProfile: profile,
          notes: call.notes,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Agent request failed');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let sources = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          let event;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (event.type === 'thinking') {
            setAgentLogs(prev => [...prev, { type: 'thinking', message: event.data.message }]);
          }
          if (event.type === 'tool_result') {
            sources++;
            setSourceCount(sources);
            setAgentLogs(prev => [...prev, { type: 'result', message: event.data.summary }]);
          }
          if (event.type === 'brief_ready') {
            setBrief(event.data.brief);
            setCompanyIntel(event.data.companyIntel);
            setStockData(event.data.stock || null);
            setStockError(event.data.stockError || null);
            setCallType(event.data.callType || call.callType);
            setAgentState('complete');
          }
          if (event.type === 'error') {
            setError(event.data.message);
            setAgentState('error');
          }
        }
      }

      setAgentState(prev => (prev === 'running' ? 'error' : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setAgentState('error');
    }
  }, [agentState]);

  // Derived data
  const painSignals = companyIntel?.painSignals || [];
  const painCount = painSignals.length;
  const dealFit = painCount >= 3 ? 'HIGH' : painCount >= 2 ? 'MED' : 'LOW';
  const dealFitStyle = CONF_STYLES[dealFit];
  const topSignal = painSignals[0] || '';
  const topSignalShort = topSignal.split(' ').slice(0, 3).join(' ');

  const isPrivate = !stockData && (stockError?.reason === 'not_found' || stockError?.reason === 'private');
  const stockPriceStr = stockData ? `$${stockData.price.toFixed(2)}` : isPrivate ? 'PRIVATE' : '—';
  const stockChangeStr = stockData
    ? `${stockData.changePercent >= 0 ? '+' : ''}${stockData.changePercent.toFixed(2)}% today`
    : isPrivate ? 'not publicly traded' : '';
  const stockColor = stockData ? (stockData.changePercent >= 0 ? '#16a34a' : '#dc2626') : '#888';

  const handleCopyEmail = async () => {
    if (!brief?.followUpEmail) return;
    const text = `Subject: ${brief.followUpEmail.subject}\n\n${stripMarkdown(brief.followUpEmail.body)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onRun={handleRun} loading={agentState === 'running'} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />

        <main style={{ flex: 1, background: '#fafaf9', padding: '32px 24px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>

            {/* ── Empty state ────────────────────────── */}
            {agentState === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '14px', color: '#cccccc', letterSpacing: '0.05em' }}>
                  [ WAITING FOR TARGET ]
                </p>
                <p style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#cccccc', marginTop: '8px' }}>
                  Configure your product and enter a prospect to begin.
                </p>
              </div>
            )}

            {/* ── Error ──────────────────────────────── */}
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
                padding: '12px 16px', marginBottom: '20px',
                fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            {/* ── Agent Thinking Panel ────────────────── */}
            {(agentState === 'running' || agentState === 'complete' || agentState === 'error') && (
              <AgentThinkingPanel logs={agentLogs} state={agentState} elapsed={elapsed} />
            )}

            {/* ════════════════════════════════════════════════
                 BRIEF OUTPUT — Option 3 Layout
                ════════════════════════════════════════════════ */}
            {brief && agentState === 'complete' && (
              <div>
                {/* 1. COMPANY TOPBAR */}
                <div className="card-reveal" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid #e8e8e4', paddingBottom: '16px', marginBottom: '16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-geist)', fontSize: '18px', fontWeight: 500, color: '#1a1a1a' }}>
                      {prospect}
                    </span>
                    {stockData?.symbol && (
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#888',
                        border: '1px solid #e8e8e4', borderRadius: '3px', padding: '1px 5px',
                      }}>
                        {stockData.symbol}
                      </span>
                    )}
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#888',
                      border: '1px solid #e8e8e4', borderRadius: '3px', padding: '1px 5px',
                    }}>
                      {callType.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc' }}>
                      {finalElapsed.current}s · {sourceCount} sources
                    </span>
                    <span className="live-dot" />
                  </div>
                </div>

                {/* 2. SECTION: open with this */}
                <SectionDivider label="// open with this" />

                {/* 3. OPENING LINE */}
                {brief.openingLine && (
                  <div className="card-reveal" style={{
                    borderLeft: '3px solid #f97316',
                    borderRadius: '0 8px 8px 0',
                    background: '#fff',
                    borderTop: '1px solid #e8e8e4',
                    borderRight: '1px solid #e8e8e4',
                    borderBottom: '1px solid #e8e8e4',
                    padding: '14px 16px',
                    marginBottom: '0',
                  }}>
                    <p style={{
                      fontFamily: 'var(--font-geist)', fontSize: '14px', fontStyle: 'italic',
                      lineHeight: 1.7, color: '#1a1a1a', margin: 0,
                    }}>
                      &ldquo;{brief.openingLine}&rdquo;
                    </p>
                  </div>
                )}

                {/* 4. SECTION: account intelligence */}
                <SectionDivider label="// account intelligence" />

                {/* 5. THREE METRIC MINI-CARDS */}
                <div className="card-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  {/* Stock */}
                  <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      stock
                    </span>
                    <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '20px', color: stockColor, margin: '6px 0 2px', fontWeight: 500 }}>
                      {stockPriceStr}
                    </p>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaa' }}>
                      {stockChangeStr}
                    </span>
                  </div>
                  {/* Top Signal */}
                  <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      top signal
                    </span>
                    <p style={{ fontFamily: 'var(--font-geist)', fontSize: '14px', color: '#f97316', margin: '6px 0 2px', fontWeight: 500 }}>
                      {topSignalShort || '—'}
                    </p>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaa' }}>
                      agent-researched
                    </span>
                  </div>
                  {/* Deal Fit */}
                  <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      deal fit
                    </span>
                    <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '20px', color: dealFitStyle.color, margin: '6px 0 2px', fontWeight: 600 }}>
                      {dealFit}
                    </p>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaa' }}>
                      {painCount} active pain signal{painCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* 6. TWO-COLUMN: Pain Signals + Call Prep */}
                <div className="card-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0' }}>
                  {/* LEFT: Pain Signals */}
                  <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        pain signals
                      </span>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#cccccc' }}>
                        detected
                      </span>
                    </div>
                    {painSignals.map((signal, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: '8px', padding: '7px 0',
                        borderBottom: i < painSignals.length - 1 ? '1px solid #f5f5f3' : 'none',
                      }}>
                        <span style={{
                          width: '5px', height: '5px', background: '#f97316',
                          borderRadius: '1px', flexShrink: 0, marginTop: '4px',
                        }} />
                        <div>
                          <div style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#1a1a1a', lineHeight: 1.5 }}>
                            {signal}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* RIGHT: Call-type-specific compact card */}
                  <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '16px' }}>
                    {/* Discovery Agenda */}
                    {callType === 'discovery' && brief.agenda && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            discovery agenda
                          </span>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#cccccc' }}>
                            {brief.agenda.length} items
                          </span>
                        </div>
                        {brief.agenda.map((a, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: i < brief.agenda!.length - 1 ? '1px solid #f5f5f3' : 'none' }}>
                            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#ccc', minWidth: '18px', flexShrink: 0 }}>
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <div style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', fontWeight: 500, color: '#1a1a1a', lineHeight: 1.5 }}>
                                {a.item}
                              </div>
                              <div style={{ fontFamily: 'var(--font-geist)', fontSize: '11px', fontStyle: 'italic', color: '#888', lineHeight: 1.5 }}>
                                {a.question}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Demo Flow */}
                    {callType === 'demo' && brief.demoScript && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            demo flow
                          </span>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#cccccc' }}>
                            5 acts
                          </span>
                        </div>
                        {brief.demoScript.map((act, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: i < brief.demoScript!.length - 1 ? '1px solid #f5f5f3' : 'none' }}>
                            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#ccc', minWidth: '18px', flexShrink: 0 }}>
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <div style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', fontWeight: 500, color: '#1a1a1a', lineHeight: 1.5 }}>
                                {act.act}
                              </div>
                              <div style={{ fontFamily: 'var(--font-geist)', fontSize: '11px', fontStyle: 'italic', color: '#888', lineHeight: 1.5 }}>
                                SAY → {act.whatToSay}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* RFP Prep */}
                    {callType === 'rfp' && brief.answerBank && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            rfp prep
                          </span>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#cccccc' }}>
                            {brief.answerBank.length} questions
                          </span>
                        </div>
                        {brief.answerBank.slice(0, 3).map((qa, i) => (
                          <div key={i} style={{ padding: '6px 0', borderBottom: i < 2 ? '1px solid #f5f5f3' : 'none' }}>
                            <div style={{ fontFamily: 'var(--font-geist)', fontSize: '12px', fontWeight: 500, color: '#1a1a1a', lineHeight: 1.5 }}>
                              {qa.question}
                            </div>
                            <div style={{
                              fontFamily: 'var(--font-geist)', fontSize: '11px', color: '#888', lineHeight: 1.5,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {qa.answer}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* 7. SECTION: call prep */}
                <SectionDivider label="// call prep" />

                {/* 8. OBJECTIONS CARD */}
                {brief.objections && brief.objections.length > 0 && (
                  <div className="card-reveal" style={{
                    background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px',
                    padding: '16px', marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        expect these objections
                      </span>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#cccccc' }}>
                        agent-generated
                      </span>
                    </div>
                    {brief.objections.map((obj, i) => {
                      const conf = CONF_STYLES[obj.confidence] ?? CONF_STYLES.MED;
                      return (
                        <div key={i} style={{
                          padding: '10px 0',
                          borderBottom: i < brief.objections!.length - 1 ? '1px solid #f5f5f3' : 'none',
                        }}>
                          <p style={{
                            fontFamily: 'var(--font-geist)', fontSize: '12px', fontStyle: 'italic',
                            color: '#1a1a1a', lineHeight: 1.5, margin: '0 0 5px',
                          }}>
                            &ldquo;{obj.objection}&rdquo;
                          </p>
                          <p style={{
                            fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#555',
                            lineHeight: 1.6, margin: '0 0 5px',
                          }}>
                            {obj.counter}
                          </p>
                          <span style={{
                            fontFamily: 'var(--font-geist-mono)', fontSize: '9px', letterSpacing: '0.1em',
                            padding: '2px 7px', borderRadius: '3px', display: 'inline-block',
                            background: conf.bg, color: conf.color, border: `1px solid ${conf.border}`,
                          }}>
                            {obj.confidence}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 9. FOLLOW-UP EMAIL */}
                {brief.followUpEmail && (
                  <div className="card-reveal" style={{
                    background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px',
                    padding: '16px', marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {'// follow-up email'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#cccccc' }}>
                        ready to send
                      </span>
                    </div>

                    <div style={{
                      position: 'relative', background: '#f9f9f8', border: '1px solid #e8e8e4',
                      borderRadius: '6px', padding: '14px', marginTop: '10px',
                      fontFamily: 'var(--font-geist-mono)', fontSize: '11px', lineHeight: 1.8, color: '#1a1a1a',
                    }}>
                      {/* COPY button */}
                      <button
                        onClick={handleCopyEmail}
                        type="button"
                        style={{
                          position: 'absolute', top: '10px', right: '10px',
                          fontFamily: 'var(--font-geist-mono)', fontSize: '9px',
                          padding: '3px 8px', borderRadius: '3px',
                          border: '1px solid #e8e8e4', background: copied ? '#f0fdf4' : '#fff',
                          color: copied ? '#16a34a' : '#888', cursor: 'pointer',
                        }}
                      >
                        {copied ? '[ COPIED ✓ ]' : '[ COPY ]'}
                      </button>

                      <div style={{ color: '#aaa', fontSize: '9px', marginBottom: '10px' }}>
                        SUBJECT: {brief.followUpEmail.subject}
                      </div>
                      <pre style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#1a1a1a',
                        lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {stripMarkdown(brief.followUpEmail.body)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 10. POWERED BY */}
                <div className="card-reveal" style={{
                  textAlign: 'center', marginTop: '16px', paddingBottom: '24px',
                }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc' }}>
                    powered by claude + tavily + finnhub
                  </span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

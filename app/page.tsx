'use client';

// brief.dev — SE Agent
// Progressive card rendering: each section appears as the agent completes it.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/Sidebar';
import type { SEProfile, CallConfig, BriefSummary } from '@/components/Sidebar';
import AgentThinkingPanel from '@/components/AgentThinkingPanel';
import type { AgentLog } from '@/components/AgentThinkingPanel';

// ─── Types ──────────────────────────────────────────────

type AgentState = 'idle' | 'running' | 'complete' | 'error';

interface SnapshotCard {
  snapshot: {
    revenue: string;
    marketCap: string;
    growth: string;
    ceo: string;
    founded: string;
    employees: string;
    description: string;
  };
  techStack: string[];
  stockSymbol?: string;
  stockIsPublic?: boolean;
  stock?: {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
  } | null;
  stockError?: { error: true; reason: string } | null;
}

interface IntelligenceCard {
  painSignals: string[];
  jobPostingInsights?: string[];
  recentDevelopments: string[];
  redFlags?: string[];
  competitiveLandscape: string;
}

interface CallPrepCard {
  openingLine: string;
  agenda?: { item: string; question: string; why: string }[];
  demoScript?: { act: string; whatToShow: string; whatToSay: string; addresses: string }[];
  answerBank?: { question: string; answer: string; tailor: string }[];
  objections: { objection: string; counter: string; confidence: 'HIGH' | 'MED' | 'LOW' }[];
}

interface EmailCard {
  subject: string;
  body: string;
}

interface Cards {
  snapshot?: SnapshotCard;
  intelligence?: IntelligenceCard;
  call_prep?: CallPrepCard;
  email?: EmailCard;
}

// ─── Helpers ─────────────────────────────────────────────

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

const CONF_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  HIGH: { bg: '#f0fdf4', color: '#16a34a', border: '#d1fae5' },
  MED:  { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' },
  LOW:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

// ─── Main ────────────────────────────────────────────────

export default function Home() {
  const { isSignedIn } = useUser();
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [briefRefreshKey, setBriefRefreshKey] = useState(0);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Cards>({});
  const [callType, setCallType] = useState<'discovery' | 'demo' | 'rfp'>('discovery');
  const [prospect, setProspect] = useState('');
  const [sourceCount, setSourceCount] = useState(0);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedOpening, setCopiedOpening] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalElapsed = useRef(0);

  useEffect(() => {
    if (agentState === 'running') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (agentState === 'complete') finalElapsed.current = elapsed;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentState]);

  const handleRun = useCallback(async (profile: SEProfile, call: CallConfig) => {
    if (agentState === 'running') return;

    setAgentState('running');
    setAgentLogs([]);
    setError(null);
    setCards({});
    setCallType(call.callType);
    setProspect(call.prospect);
    setSourceCount(0);
    finalElapsed.current = 0;

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
      let localCards: Cards = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === 'thinking') {
            setAgentLogs(prev => [...prev, { type: 'thinking', message: event.data.message }]);
          }
          if (event.type === 'tool_result') {
            sources++;
            setSourceCount(sources);
            setAgentLogs(prev => [...prev, { type: 'result', message: event.data.summary }]);
          }
          if (event.type === 'card_ready') {
            localCards = { ...localCards, [event.data.type]: event.data.data };
            setCards(localCards);
          }
          if (event.type === 'agent_complete') {
            setAgentState('complete');
            // Persist brief to DB for signed-in users (non-fatal)
            if (isSignedIn) {
              fetch('/api/briefs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prospect: call.prospect,
                  callType: call.callType,
                  notes: call.notes,
                  cards: localCards,
                }),
              })
                .then(() => setBriefRefreshKey(k => k + 1))
                .catch(() => { /* non-fatal */ });
            }
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
  }, [agentState, isSignedIn]);

  // Stock display
  const stock = cards.snapshot?.stock;
  const stockError = cards.snapshot?.stockError;
  const isPrivate = !stock && (stockError?.reason === 'not_found' || stockError?.reason === 'private' || !cards.snapshot?.stockIsPublic);
  const stockPriceStr = stock ? `$${stock.price.toFixed(2)}` : isPrivate ? 'PRIVATE' : '—';
  const stockChangeStr = stock
    ? `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}% today`
    : isPrivate ? 'not publicly traded' : '';
  const stockColor = stock ? (stock.changePercent >= 0 ? '#16a34a' : '#dc2626') : '#888';

  // Deal fit from pain signals
  const painSignals = cards.intelligence?.painSignals ?? [];
  const painCount = painSignals.length;
  const dealFit = painCount >= 3 ? 'HIGH' : painCount >= 2 ? 'MED' : 'LOW';
  const dealFitStyle = CONF_STYLES[dealFit];
  const topSignalShort = (painSignals[0] || '').split(' ').slice(0, 3).join(' ');

  const handleCopyEmail = async () => {
    const email = cards.email;
    if (!email) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch { /* ignore */ }
  };

  const handleCopyOpening = async () => {
    const line = cards.call_prep?.openingLine;
    if (!line) return;
    try {
      await navigator.clipboard.writeText(line);
      setCopiedOpening(true);
      setTimeout(() => setCopiedOpening(false), 2000);
    } catch { /* ignore */ }
  };

  const handleRestoreBrief = useCallback((brief: BriefSummary) => {
    setCards(brief.cards as Cards);
    setProspect(brief.prospect);
    setCallType(brief.call_type as 'discovery' | 'demo' | 'rfp');
    setAgentState('complete');
    setAgentLogs([]);
    setError(null);
    finalElapsed.current = 0;
  }, []);

  const hasAnyCard = !!(cards.snapshot || cards.intelligence || cards.call_prep || cards.email);
  const showHeader = hasAnyCard || agentState === 'running';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onRun={handleRun} onRestoreBrief={handleRestoreBrief} loading={agentState === 'running'} briefRefreshKey={briefRefreshKey} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <main style={{ flex: 1, background: '#fafaf9', padding: '32px 24px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>

            {/* ── Empty state ──────────────────────────── */}
            {agentState === 'idle' && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', minHeight: '60vh',
              }}>
                <p style={{
                  fontFamily: 'var(--font-geist-mono)', fontSize: '14px',
                  color: '#cccccc', letterSpacing: '0.05em',
                }}>
                  [ WAITING FOR TARGET ]
                </p>
                <p style={{
                  fontFamily: 'var(--font-geist)', fontSize: '12px',
                  color: '#cccccc', marginTop: '8px',
                }}>
                  Configure your product and enter a prospect to begin.
                </p>
              </div>
            )}

            {/* ── Error ────────────────────────────────── */}
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
                padding: '12px 16px', marginBottom: '20px',
                fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            {/* ── Agent thinking panel ─────────────────── */}
            {(agentState === 'running' || agentState === 'complete' || agentState === 'error') && (
              <AgentThinkingPanel logs={agentLogs} state={agentState} elapsed={elapsed} />
            )}

            {/* ════════════════════════════════════════════
                 PROGRESSIVE BRIEF OUTPUT
                ════════════════════════════════════════════ */}

            {/* Company header — appears as soon as snapshot is ready */}
            {showHeader && (
              <div className="card-reveal" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid #e8e8e4', paddingBottom: '16px', marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontFamily: 'var(--font-geist)', fontSize: '18px',
                    fontWeight: 500, color: '#1a1a1a',
                  }}>
                    {prospect}
                  </span>
                  {cards.snapshot?.stockSymbol && (
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#888',
                      border: '1px solid #e8e8e4', borderRadius: '3px', padding: '1px 5px',
                    }}>
                      {cards.snapshot.stockSymbol}
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
                    {agentState === 'complete' ? `${finalElapsed.current}s` : `${elapsed}s`}
                    {sourceCount > 0 && ` · ${sourceCount} sources`}
                  </span>
                  <span className="live-dot" />
                </div>
              </div>
            )}

            {/* ── SNAPSHOT CARD ────────────────────────── */}
            {cards.snapshot && (
              <>
                <SectionDivider label="// company overview" />

                {/* 3 metric mini-cards */}
                <div className="card-reveal" style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px',
                }}>
                  {/* Stock */}
                  <div style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '12px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      stock
                    </span>
                    <p style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '20px',
                      color: stockColor, margin: '6px 0 2px', fontWeight: 500,
                    }}>
                      {stockPriceStr}
                    </p>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaa' }}>
                      {stockChangeStr}
                    </span>
                  </div>

                  {/* Revenue */}
                  <div style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '12px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      revenue
                    </span>
                    <p style={{
                      fontFamily: 'var(--font-geist)', fontSize: '16px',
                      color: '#1a1a1a', margin: '6px 0 2px', fontWeight: 500,
                    }}>
                      {cards.snapshot.snapshot.revenue}
                    </p>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaa' }}>
                      {cards.snapshot.snapshot.growth} growth
                    </span>
                  </div>

                  {/* Headcount */}
                  <div style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '12px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      employees
                    </span>
                    <p style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '16px',
                      color: '#1a1a1a', margin: '6px 0 2px', fontWeight: 500,
                    }}>
                      {cards.snapshot.snapshot.employees}
                    </p>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaa' }}>
                      CEO: {cards.snapshot.snapshot.ceo}
                    </span>
                  </div>
                </div>

                {/* Description + tech stack */}
                <div className="card-reveal" style={{
                  background: '#fff', border: '1px solid #e8e8e4',
                  borderRadius: '8px', padding: '16px', marginBottom: '0',
                }}>
                  <p style={{
                    fontFamily: 'var(--font-geist)', fontSize: '13px', color: '#444',
                    lineHeight: 1.6, margin: '0 0 12px',
                  }}>
                    {cards.snapshot.snapshot.description}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {cards.snapshot.techStack.map((tech, i) => (
                      <span key={i} style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '10px',
                        background: '#f5f5f3', color: '#555', border: '1px solid #e8e8e4',
                        borderRadius: '3px', padding: '2px 8px',
                      }}>
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── INTELLIGENCE CARD ────────────────────── */}
            {cards.intelligence && (
              <>
                <SectionDivider label="// account intelligence" />

                {/* Deal fit mini-card + top signal */}
                <div className="card-reveal" style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px',
                }}>
                  <div style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '12px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      deal fit
                    </span>
                    <p style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '20px',
                      color: dealFitStyle.color, margin: '6px 0 2px', fontWeight: 600,
                    }}>
                      {dealFit}
                    </p>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaa' }}>
                      {painCount} active pain signal{painCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '12px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      top signal
                    </span>
                    <p style={{
                      fontFamily: 'var(--font-geist)', fontSize: '14px',
                      color: '#f97316', margin: '6px 0 2px', fontWeight: 500,
                    }}>
                      {topSignalShort || '—'}
                    </p>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaa' }}>
                      agent-researched
                    </span>
                  </div>
                </div>

                {/* Pain signals + recent developments */}
                <div className="card-reveal" style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px',
                }}>
                  {/* Pain signals */}
                  <div style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '16px',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: '12px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>
                        pain signals
                      </span>
                    </div>
                    {cards.intelligence.painSignals.map((signal, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: '8px', padding: '7px 0',
                        borderBottom: i < cards.intelligence!.painSignals.length - 1
                          ? '1px solid #f5f5f3' : 'none',
                      }}>
                        <span style={{
                          width: '5px', height: '5px', background: '#f97316',
                          borderRadius: '1px', flexShrink: 0, marginTop: '5px',
                        }} />
                        <div style={{
                          fontFamily: 'var(--font-geist)', fontSize: '12px',
                          color: '#1a1a1a', lineHeight: 1.5,
                        }}>
                          {signal}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recent developments */}
                  <div style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '16px',
                  }}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>
                        recent developments
                      </span>
                    </div>
                    {cards.intelligence.recentDevelopments.map((dev, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: '8px', padding: '7px 0',
                        borderBottom: i < cards.intelligence!.recentDevelopments.length - 1
                          ? '1px solid #f5f5f3' : 'none',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-geist-mono)', fontSize: '10px',
                          color: '#ccc', flexShrink: 0, marginTop: '1px',
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div style={{
                          fontFamily: 'var(--font-geist)', fontSize: '12px',
                          color: '#1a1a1a', lineHeight: 1.5,
                        }}>
                          {dev}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Job insights + red flags (if present) */}
                {((cards.intelligence.jobPostingInsights?.length ?? 0) > 0 ||
                  (cards.intelligence.redFlags?.length ?? 0) > 0) && (
                  <div className="card-reveal" style={{
                    display: 'grid',
                    gridTemplateColumns: (cards.intelligence.jobPostingInsights?.length ?? 0) > 0 &&
                      (cards.intelligence.redFlags?.length ?? 0) > 0 ? '1fr 1fr' : '1fr',
                    gap: '8px',
                  }}>
                    {(cards.intelligence.jobPostingInsights?.length ?? 0) > 0 && (
                      <div style={{
                        background: '#fff', border: '1px solid #e8e8e4',
                        borderRadius: '8px', padding: '16px',
                      }}>
                        <div style={{ marginBottom: '12px' }}>
                          <span style={{
                            fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                          }}>
                            hiring signals
                          </span>
                        </div>
                        {cards.intelligence.jobPostingInsights!.map((insight, i) => (
                          <div key={i} style={{
                            display: 'flex', gap: '8px', padding: '6px 0',
                            borderBottom: i < cards.intelligence!.jobPostingInsights!.length - 1
                              ? '1px solid #f5f5f3' : 'none',
                          }}>
                            <span style={{
                              width: '5px', height: '5px', background: '#3b82f6',
                              borderRadius: '1px', flexShrink: 0, marginTop: '5px',
                            }} />
                            <div style={{
                              fontFamily: 'var(--font-geist)', fontSize: '12px',
                              color: '#1a1a1a', lineHeight: 1.5,
                            }}>
                              {insight}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(cards.intelligence.redFlags?.length ?? 0) > 0 && (
                      <div style={{
                        background: '#fff', border: '1px solid #fecaca',
                        borderRadius: '8px', padding: '16px',
                      }}>
                        <div style={{ marginBottom: '12px' }}>
                          <span style={{
                            fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#fca5a5',
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                          }}>
                            red flags
                          </span>
                        </div>
                        {cards.intelligence.redFlags!.map((flag, i) => (
                          <div key={i} style={{
                            display: 'flex', gap: '8px', padding: '6px 0',
                            borderBottom: i < cards.intelligence!.redFlags!.length - 1
                              ? '1px solid #fef2f2' : 'none',
                          }}>
                            <span style={{
                              width: '5px', height: '5px', background: '#dc2626',
                              borderRadius: '1px', flexShrink: 0, marginTop: '5px',
                            }} />
                            <div style={{
                              fontFamily: 'var(--font-geist)', fontSize: '12px',
                              color: '#dc2626', lineHeight: 1.5,
                            }}>
                              {flag}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Competitive landscape */}
                {cards.intelligence.competitiveLandscape && (
                  <div className="card-reveal" style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '14px 16px', marginTop: '8px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                      letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block',
                      marginBottom: '8px',
                    }}>
                      competitive landscape
                    </span>
                    <p style={{
                      fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#444',
                      lineHeight: 1.6, margin: 0,
                    }}>
                      {cards.intelligence.competitiveLandscape}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── CALL PREP CARD ───────────────────────── */}
            {cards.call_prep && (
              <>
                <SectionDivider label="// call prep" />

                {/* Opening line */}
                <div className="card-reveal" style={{
                  borderLeft: '3px solid #f97316',
                  borderRadius: '0 8px 8px 0',
                  background: '#fff',
                  border: '1px solid #e8e8e4',
                  borderLeftColor: '#f97316',
                  borderLeftWidth: '3px',
                  padding: '14px 16px',
                  marginBottom: '8px',
                  position: 'relative',
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: '12px',
                  }}>
                    <div>
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                        letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block',
                        marginBottom: '8px',
                      }}>
                        open with this
                      </span>
                      <p style={{
                        fontFamily: 'var(--font-geist)', fontSize: '14px', fontStyle: 'italic',
                        lineHeight: 1.7, color: '#1a1a1a', margin: 0,
                      }}>
                        &ldquo;{cards.call_prep.openingLine}&rdquo;
                      </p>
                    </div>
                    <button
                      onClick={handleCopyOpening}
                      type="button"
                      style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px',
                        padding: '4px 10px', borderRadius: '3px', flexShrink: 0,
                        border: '1px solid #e8e8e4',
                        background: copiedOpening ? '#f0fdf4' : '#fff',
                        color: copiedOpening ? '#16a34a' : '#888',
                        cursor: 'pointer', marginTop: '2px',
                      }}
                    >
                      {copiedOpening ? '[ COPIED ✓ ]' : '[ COPY ]'}
                    </button>
                  </div>
                </div>

                {/* Discovery agenda */}
                {callType === 'discovery' && cards.call_prep.agenda && (
                  <div className="card-reveal" style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '16px', marginBottom: '8px',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: '14px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>
                        discovery agenda
                      </span>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#ccc' }}>
                        {cards.call_prep.agenda.length} items
                      </span>
                    </div>
                    {cards.call_prep.agenda.map((a, i) => (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '20px 1fr', gap: '10px',
                        padding: '10px 0',
                        borderBottom: i < cards.call_prep!.agenda!.length - 1
                          ? '1px solid #f5f5f3' : 'none',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-geist-mono)', fontSize: '10px',
                          color: '#ccc', paddingTop: '2px',
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <div style={{
                            fontFamily: 'var(--font-geist)', fontSize: '13px',
                            fontWeight: 500, color: '#1a1a1a', lineHeight: 1.5,
                          }}>
                            {a.item}
                          </div>
                          <div style={{
                            fontFamily: 'var(--font-geist)', fontSize: '12px',
                            fontStyle: 'italic', color: '#888', lineHeight: 1.5,
                          }}>
                            {a.question}
                          </div>
                          <div style={{
                            fontFamily: 'var(--font-geist-mono)', fontSize: '10px',
                            color: '#bbb', marginTop: '3px',
                          }}>
                            why → {a.why}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Demo script */}
                {callType === 'demo' && cards.call_prep.demoScript && (
                  <div className="card-reveal" style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '16px', marginBottom: '8px',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: '14px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>
                        demo script
                      </span>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#ccc' }}>
                        5 acts
                      </span>
                    </div>
                    {cards.call_prep.demoScript.map((act, i) => (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '20px 1fr', gap: '10px',
                        padding: '10px 0',
                        borderBottom: i < cards.call_prep!.demoScript!.length - 1
                          ? '1px solid #f5f5f3' : 'none',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-geist-mono)', fontSize: '10px',
                          color: '#ccc', paddingTop: '2px',
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <div style={{
                            fontFamily: 'var(--font-geist)', fontSize: '13px',
                            fontWeight: 500, color: '#1a1a1a',
                          }}>
                            {act.act}
                          </div>
                          <div style={{
                            fontFamily: 'var(--font-geist-mono)', fontSize: '11px',
                            color: '#555', margin: '4px 0 2px',
                          }}>
                            SHOW → {act.whatToShow}
                          </div>
                          <div style={{
                            fontFamily: 'var(--font-geist)', fontSize: '12px',
                            fontStyle: 'italic', color: '#888', lineHeight: 1.5,
                          }}>
                            SAY → {act.whatToSay}
                          </div>
                          <div style={{
                            fontFamily: 'var(--font-geist-mono)', fontSize: '10px',
                            color: '#f97316', marginTop: '3px',
                          }}>
                            addresses → {act.addresses}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* RFP answer bank */}
                {callType === 'rfp' && cards.call_prep.answerBank && (
                  <div className="card-reveal" style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '16px', marginBottom: '8px',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: '14px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>
                        rfp answer bank
                      </span>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#ccc' }}>
                        {cards.call_prep.answerBank.length} questions
                      </span>
                    </div>
                    {cards.call_prep.answerBank.map((qa, i) => (
                      <div key={i} style={{
                        padding: '10px 0',
                        borderBottom: i < cards.call_prep!.answerBank!.length - 1
                          ? '1px solid #f5f5f3' : 'none',
                      }}>
                        <div style={{
                          fontFamily: 'var(--font-geist)', fontSize: '12px',
                          fontWeight: 500, color: '#1a1a1a', marginBottom: '4px',
                        }}>
                          {qa.question}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-geist)', fontSize: '12px',
                          color: '#555', lineHeight: 1.6, marginBottom: '4px',
                        }}>
                          {qa.answer}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbb',
                        }}>
                          tailor → {qa.tailor}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Objections */}
                {cards.call_prep.objections.length > 0 && (
                  <div className="card-reveal" style={{
                    background: '#fff', border: '1px solid #e8e8e4',
                    borderRadius: '8px', padding: '16px',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: '14px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>
                        expect these objections
                      </span>
                    </div>
                    {cards.call_prep.objections.map((obj, i) => {
                      const conf = CONF_STYLES[obj.confidence] ?? CONF_STYLES.MED;
                      return (
                        <div key={i} style={{
                          padding: '10px 0',
                          borderBottom: i < cards.call_prep!.objections.length - 1
                            ? '1px solid #f5f5f3' : 'none',
                        }}>
                          <p style={{
                            fontFamily: 'var(--font-geist)', fontSize: '12px',
                            fontStyle: 'italic', color: '#1a1a1a', lineHeight: 1.5,
                            margin: '0 0 5px',
                          }}>
                            &ldquo;{obj.objection}&rdquo;
                          </p>
                          <p style={{
                            fontFamily: 'var(--font-geist)', fontSize: '12px',
                            color: '#555', lineHeight: 1.6, margin: '0 0 6px',
                          }}>
                            {obj.counter}
                          </p>
                          <span style={{
                            fontFamily: 'var(--font-geist-mono)', fontSize: '9px',
                            letterSpacing: '0.1em', padding: '2px 7px', borderRadius: '3px',
                            display: 'inline-block',
                            background: conf.bg, color: conf.color, border: `1px solid ${conf.border}`,
                          }}>
                            {obj.confidence}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── EMAIL CARD ───────────────────────────── */}
            {cards.email && (
              <>
                <SectionDivider label="// follow-up email" />

                <div className="card-reveal" style={{
                  background: '#fff', border: '1px solid #e8e8e4',
                  borderRadius: '8px', padding: '16px',
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: '12px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#bbbbbb',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      ready to send
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a
                        href={`mailto:?subject=${encodeURIComponent(cards.email.subject)}&body=${encodeURIComponent(cards.email.body)}`}
                        style={{
                          fontFamily: 'var(--font-geist-mono)', fontSize: '9px',
                          padding: '3px 8px', borderRadius: '3px',
                          border: '1px solid #e8e8e4', background: '#fff',
                          color: '#888', textDecoration: 'none', cursor: 'pointer',
                        }}
                      >
                        [ OPEN IN MAIL ]
                      </a>
                      <button
                        onClick={handleCopyEmail}
                        type="button"
                        style={{
                          fontFamily: 'var(--font-geist-mono)', fontSize: '9px',
                          padding: '3px 8px', borderRadius: '3px',
                          border: '1px solid #e8e8e4',
                          background: copiedEmail ? '#f0fdf4' : '#fff',
                          color: copiedEmail ? '#16a34a' : '#888',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedEmail ? '[ COPIED ✓ ]' : '[ COPY ]'}
                      </button>
                    </div>
                  </div>

                  <div style={{
                    background: '#f9f9f8', border: '1px solid #e8e8e4',
                    borderRadius: '6px', padding: '14px',
                    fontFamily: 'var(--font-geist-mono)', fontSize: '11px',
                    lineHeight: 1.8, color: '#1a1a1a',
                  }}>
                    <div style={{ color: '#aaa', fontSize: '9px', marginBottom: '10px' }}>
                      SUBJECT: {cards.email.subject}
                    </div>
                    <pre style={{
                      fontFamily: 'var(--font-geist-mono)', fontSize: '11px',
                      lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {cards.email.body}
                    </pre>
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            {agentState === 'complete' && (
              <div className="card-reveal" style={{ textAlign: 'center', marginTop: '16px', paddingBottom: '24px' }}>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc' }}>
                  powered by claude + tavily + finnhub
                </span>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

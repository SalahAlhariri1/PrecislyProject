'use client';

// brief.dev — SE Agent
// Split layout: sidebar (product config + call setup) | main (agent thinking + brief cards)

import { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import type { SEProfile, CallConfig } from '@/components/Sidebar';
import AgentThinkingPanel from '@/components/AgentThinkingPanel';
import type { AgentLog } from '@/components/AgentThinkingPanel';
import StockCard from '@/components/StockCard';
import SnapshotCard from '@/components/SnapshotCard';
import OpeningLineCard from '@/components/OpeningLineCard';
import PainSignalsCard from '@/components/PainSignalsCard';
import TechStackCard from '@/components/TechStackCard';
import ObjectionsCard from '@/components/ObjectionsCard';
import EmailCard from '@/components/EmailCard';
import DiscoveryAgendaCard from '@/components/DiscoveryAgendaCard';
import DemoScriptCard from '@/components/DemoScriptCard';
import RFPAnswerBankCard from '@/components/RFPAnswerBankCard';

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

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0 16px 0' }}>
      <span style={{
        fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc',
        letterSpacing: '0.1em', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: '#e8e8e4' }} />
    </div>
  );
}

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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer effect
  useEffect(() => {
    if (agentState === 'running') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

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

      // If we finished reading but never got brief_ready or error
      setAgentState(prev => (prev === 'running' ? 'error' : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setAgentState('error');
    }
  }, [agentState]);

  // Build snapshot object for SnapshotCard — handle both string and object forms
  const snapshotObj = companyIntel?.snapshot
    ? typeof companyIntel.snapshot === 'string'
      ? { revenue: '', marketCap: '', growth: '', ceo: '', founded: '', employees: '', description: companyIntel.snapshot }
      : companyIntel.snapshot
    : null;

  // Build pain signals array from companyIntel for PainSignalsCard
  const painSignals = (companyIntel?.painSignals || []).map(s => ({ signal: s, why: '' }));

  // Email label based on call type
  const emailLabel = callType === 'rfp' ? '// rfp cover email' : callType === 'demo' ? '// demo follow-up' : '// send this after';

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

            {/* ── Brief results ──────────────────────── */}
            {brief && agentState === 'complete' && (
              <div>
                {/* Company header */}
                <div className="card-reveal" style={{
                  background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px',
                  padding: '16px', marginBottom: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{
                        fontFamily: 'var(--font-geist)', fontSize: '18px', fontWeight: 600,
                        color: '#1a1a1a', margin: 0,
                      }}>
                        {prospect}
                      </h2>
                      {snapshotObj?.description && (
                        <p style={{
                          fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#888',
                          margin: '4px 0 0 0', lineHeight: 1.5,
                        }}>
                          {snapshotObj.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#888',
                        border: '1px solid #e8e8e4', borderRadius: '4px', padding: '2px 6px',
                      }}>
                        {callType.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <SectionDivider label="// ACCOUNT INTELLIGENCE" />

                {/* Stock + Snapshot row */}
                <div className="card-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <StockCard stock={stockData}
                    isPrivate={stockError?.reason === 'not_found' || stockError?.reason === 'private'} />
                  {snapshotObj ? (
                    <SnapshotCard snapshot={snapshotObj} />
                  ) : (
                    <div style={{
                      background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px',
                      padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#ccc' }}>
                        No snapshot data
                      </span>
                    </div>
                  )}
                </div>

                {/* Tech Stack + Recent Developments */}
                {(companyIntel?.techStack || companyIntel?.recentDevelopments) && (
                  <div className="card-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <TechStackCard
                      likely={companyIntel?.techStack || []}
                      source="agent-researched"
                    />
                    {/* Recent developments as a simple card */}
                    <div style={{
                      background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '16px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        display: 'block', marginBottom: '12px',
                      }}>
                        {'// recent developments'}
                      </span>
                      {(companyIntel?.recentDevelopments || []).map((d, i) => (
                        <p key={i} style={{
                          fontFamily: 'var(--font-geist)', fontSize: '12px', color: '#555',
                          margin: i > 0 ? '6px 0 0 0' : '0', lineHeight: 1.5,
                        }}>
                          • {d}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Opening Line */}
                {brief.openingLine && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <OpeningLineCard line={brief.openingLine} />
                  </div>
                )}

                {/* Pain Signals */}
                {painSignals.length > 0 && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <PainSignalsCard signals={painSignals} />
                  </div>
                )}

                <SectionDivider label="// CALL PREP" />

                {/* Call-type-specific card */}
                {callType === 'discovery' && brief.agenda && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <DiscoveryAgendaCard agenda={brief.agenda} />
                  </div>
                )}
                {callType === 'demo' && brief.demoScript && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <DemoScriptCard script={brief.demoScript} />
                  </div>
                )}
                {callType === 'rfp' && brief.answerBank && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <RFPAnswerBankCard answers={brief.answerBank} />
                  </div>
                )}

                {/* Objections */}
                {brief.objections && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <ObjectionsCard objections={brief.objections} />
                  </div>
                )}

                {/* Follow-up Email */}
                {brief.followUpEmail && (
                  <div className="card-reveal" style={{ marginBottom: '24px' }}>
                    <EmailCard
                      label={emailLabel}
                      subject={brief.followUpEmail.subject}
                      body={brief.followUpEmail.body}
                    />
                  </div>
                )}

                {/* Bottom row */}
                <div className="card-reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
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

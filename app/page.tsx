'use client';

// brief.dev — SE Agent
// Split layout: sidebar (product config + call setup) | main (intelligence brief + call prep)

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import type { SEProfile, CallConfig } from '@/components/Sidebar';
import CompanyHeader from '@/components/CompanyHeader';
import StockCard from '@/components/StockCard';
import SnapshotCard from '@/components/SnapshotCard';
import NewsCard from '@/components/NewsCard';
import PainSignalsCard from '@/components/PainSignalsCard';
import TechStackCard from '@/components/TechStackCard';
import RedFlagsCard from '@/components/RedFlagsCard';
import OpeningLineCard from '@/components/OpeningLineCard';
import TalkingPointsCard from '@/components/TalkingPointsCard';
import ObjectionsCard from '@/components/ObjectionsCard';
import EmailCard from '@/components/EmailCard';
import DiscoveryAgendaCard from '@/components/DiscoveryAgendaCard';
import DemoScriptCard from '@/components/DemoScriptCard';
import RFPAnswerBankCard from '@/components/RFPAnswerBankCard';
import SkeletonCard from '@/components/SkeletonCard';

// ─── Types ──────────────────────────────────────────────

type RevealStage =
  | 'idle' | 'header' | 'stock' | 'techstack' | 'news'
  | 'opening' | 'pain' | 'talking'
  | 'agent-1' | 'agent-2' | 'agent-3'
  | 'done';

interface BriefData {
  company: string;
  fetchedAt: string;
  stock: {
    symbol: string; price: number; change: number; changePercent: number;
    high: number; low: number; volume: string; sparkline: number[];
  } | null;
  stockError: { error: true; reason: string } | null;
  news: { articles: { title: string; source: string; url: string; publishedAt: string; sentiment: 'positive' | 'negative' | 'neutral' }[]; error?: string };
  snapshot: { revenue: string; marketCap: string; growth: string; ceo: string; founded: string; employees: string; description: string };
  painSignals: { signal: string; why: string }[];
  techStack: { likely: string[]; source: string };
  competitivePressure: { competitors: string[]; insight: string };
  decisionMakers: { title: string; focus: string }[];
  openingLine: string;
  redFlags: string[];
  talkingPoints: { point: string; evidence: string }[];
}

interface AgentData {
  callType: 'discovery' | 'demo' | 'rfp';
  // Discovery
  agenda?: { item: string; question: string; why: string }[];
  // Demo
  demoScript?: { act: string; whatToShow: string; whatToSay: string; addresses: string }[];
  // RFP
  answerBank?: { question: string; answer: string; tailor: string }[];
  // Shared
  objections?: { objection: string; counter: string; confidence: 'HIGH' | 'MED' | 'LOW' }[];
  followUpEmail?: { subject: string; body: string };
  coverEmail?: { subject: string; body: string };
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [stage, setStage] = useState<RevealStage>('idle');
  const [callType, setCallType] = useState<'discovery' | 'demo' | 'rfp'>('discovery');

  const stageOrder: RevealStage[] = [
    'header', 'stock', 'techstack', 'news', 'opening', 'pain', 'talking',
    'agent-1', 'agent-2', 'agent-3', 'done',
  ];
  const isRevealed = (s: RevealStage) => stageOrder.indexOf(stage) >= stageOrder.indexOf(s);

  const handleRun = async (profile: SEProfile, call: CallConfig) => {
    if (loading) return;

    setLoading(true);
    setError(null);
    setBrief(null);
    setAgent(null);
    setStage('idle');
    setCallType(call.callType);

    try {
      // Phase 1: get company intelligence
      const briefRes = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: call.prospect }),
      });

      if (!briefRes.ok) {
        const err = await briefRes.json();
        throw new Error(err.error ?? 'Brief request failed');
      }

      const briefJson: BriefData = await briefRes.json();
      setBrief(briefJson);

      // Reveal company data cards
      for (const s of ['header', 'stock', 'techstack', 'news', 'opening', 'pain', 'talking'] as RevealStage[]) {
        setStage(s);
        await delay(150);
      }

      // Phase 2: get call-type-specific agent prep
      const stockChange = briefJson.stock
        ? `${briefJson.stock.change >= 0 ? '+' : ''}${briefJson.stock.change.toFixed(2)} (${briefJson.stock.changePercent >= 0 ? '+' : ''}${briefJson.stock.changePercent.toFixed(2)}%)`
        : 'N/A';

      const agentRes = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect: call.prospect,
          callType: call.callType,
          seProfile: profile,
          notes: call.notes,
          companyData: {
            snapshot: briefJson.snapshot,
            news: briefJson.news.articles,
            stockChange,
            techStack: briefJson.techStack.likely,
            painSignals: briefJson.painSignals,
          },
        }),
      });

      if (!agentRes.ok) {
        const err = await agentRes.json();
        throw new Error(err.error ?? 'Agent request failed');
      }

      const agentJson: AgentData = await agentRes.json();
      setAgent(agentJson);

      // Reveal agent cards
      for (const s of ['agent-1', 'agent-2', 'agent-3', 'done'] as RevealStage[]) {
        setStage(s);
        await delay(150);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Get the email label and data based on call type
  const emailLabel = callType === 'rfp' ? '// rfp cover email' : callType === 'demo' ? '// demo follow-up' : '// send this after';
  const emailData = agent?.coverEmail ?? agent?.followUpEmail;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onRun={handleRun} loading={loading} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />

        <main style={{ flex: 1, background: '#fafaf9', padding: '32px 24px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>

            {/* ── Empty state ────────────────────────── */}
            {stage === 'idle' && !loading && !error && (
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

            {/* ── Loading skeletons ──────────────────── */}
            {loading && !brief && (
              <div>
                <SkeletonCard height={70} rows={2} />
                <div style={{ height: '10px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <SkeletonCard height={160} rows={4} />
                  <SkeletonCard height={160} rows={5} />
                </div>
                <div style={{ height: '10px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <SkeletonCard height={120} rows={4} />
                  <SkeletonCard height={120} rows={3} />
                </div>
                <div style={{ height: '10px' }} />
                <SkeletonCard height={140} rows={4} />
                <div style={{ height: '10px' }} />
                <SkeletonCard height={80} rows={2} />
                <div style={{ height: '10px' }} />
                <SkeletonCard height={160} rows={4} />
              </div>
            )}

            {/* ── Agent loading skeletons (brief done, agent in progress) ── */}
            {loading && brief && !agent && (
              <div style={{ marginTop: '10px' }}>
                <SkeletonCard height={200} rows={6} />
                <div style={{ height: '10px' }} />
                <SkeletonCard height={160} rows={4} />
                <div style={{ height: '10px' }} />
                <SkeletonCard height={180} rows={5} />
              </div>
            )}

            {/* ── Brief results ──────────────────────── */}
            {brief && (
              <div>
                {isRevealed('header') && (
                  <div className="card-reveal">
                    <CompanyHeader company={brief.company} fetchedAt={brief.fetchedAt}
                      ticker={brief.stock?.symbol ?? null} snapshot={brief.snapshot} />
                  </div>
                )}

                {isRevealed('stock') && (
                  <div className="card-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <StockCard stock={brief.stock}
                      isPrivate={brief.stockError?.reason === 'not_found' || brief.stockError?.reason === 'private'} />
                    <SnapshotCard snapshot={brief.snapshot} />
                  </div>
                )}

                {isRevealed('techstack') && (
                  <div className="card-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <TechStackCard likely={brief.techStack.likely} source={brief.techStack.source} />
                    <RedFlagsCard flags={brief.redFlags} />
                  </div>
                )}

                {isRevealed('news') && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <NewsCard articles={brief.news.articles} error={brief.news.error} />
                  </div>
                )}

                {isRevealed('opening') && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <OpeningLineCard line={brief.openingLine} />
                  </div>
                )}

                {isRevealed('pain') && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <PainSignalsCard signals={brief.painSignals} />
                  </div>
                )}

                {isRevealed('talking') && (
                  <div className="card-reveal" style={{ marginBottom: '10px' }}>
                    <TalkingPointsCard points={brief.talkingPoints} />
                  </div>
                )}

                {/* ── Agent results ───────────────────── */}
                {agent && (
                  <>
                    {/* Card 1: call-type-specific main card */}
                    {isRevealed('agent-1') && (
                      <div className="card-reveal" style={{ marginBottom: '10px' }}>
                        {callType === 'discovery' && agent.agenda && (
                          <DiscoveryAgendaCard agenda={agent.agenda} />
                        )}
                        {callType === 'demo' && agent.demoScript && (
                          <DemoScriptCard script={agent.demoScript} />
                        )}
                        {callType === 'rfp' && agent.answerBank && (
                          <RFPAnswerBankCard answers={agent.answerBank} />
                        )}
                      </div>
                    )}

                    {/* Card 2: objections */}
                    {isRevealed('agent-2') && agent.objections && (
                      <div className="card-reveal" style={{ marginBottom: '10px' }}>
                        <ObjectionsCard objections={agent.objections} />
                      </div>
                    )}

                    {/* Card 3: follow-up email */}
                    {isRevealed('agent-3') && emailData && (
                      <div className="card-reveal" style={{ marginBottom: '24px' }}>
                        <EmailCard label={emailLabel} subject={emailData.subject} body={emailData.body} />
                      </div>
                    )}
                  </>
                )}

                {/* Bottom row */}
                {isRevealed('done') && (
                  <div className="card-reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
                      powered by claude + newsapi + finnhub
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['[ export pdf ]', '[ copy ]'] as const).map(label => (
                        <button key={label} style={{
                          fontFamily: 'var(--font-geist-mono)', fontSize: '10px', letterSpacing: '0.1em',
                          padding: '4px 10px', border: '1px solid #e8e8e4', borderRadius: '4px',
                          background: 'transparent', color: '#888888', cursor: 'pointer',
                        }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

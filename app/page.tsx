'use client';

// brief.dev — main page
// Handles search state, API call orchestration, and sequential card reveal

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import SearchBox from '@/components/SearchBox';
import CompanyHeader from '@/components/CompanyHeader';
import StockCard from '@/components/StockCard';
import SnapshotCard from '@/components/SnapshotCard';
import NewsCard from '@/components/NewsCard';
import TalkingPointsCard from '@/components/TalkingPointsCard';
import PainSignalsCard from '@/components/PainSignalsCard';
import OpeningLineCard from '@/components/OpeningLineCard';
import TechStackCard from '@/components/TechStackCard';
import RedFlagsCard from '@/components/RedFlagsCard';
import SkeletonCard from '@/components/SkeletonCard';

// Staged reveal order
type RevealStage =
  | 'idle' | 'header' | 'stock' | 'snapshot'
  | 'techstack' | 'news' | 'opening' | 'pain'
  | 'talking' | 'done';

interface BriefData {
  company: string;
  fetchedAt: string;
  stock: {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    volume: string;
    sparkline: number[];
  } | null;
  stockError: { error: true; reason: string } | null;
  news: {
    articles: {
      title: string;
      source: string;
      url: string;
      publishedAt: string;
      sentiment: 'positive' | 'negative' | 'neutral';
    }[];
    error?: string;
  };
  snapshot: {
    revenue: string;
    marketCap: string;
    growth: string;
    ceo: string;
    founded: string;
    employees: string;
    description: string;
  };
  painSignals: { signal: string; why: string }[];
  techStack: { likely: string[]; source: string };
  competitivePressure: { competitors: string[]; insight: string };
  decisionMakers: { title: string; focus: string }[];
  openingLine: string;
  redFlags: string[];
  talkingPoints: { point: string; evidence: string }[];
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BriefData | null>(null);
  const [stage, setStage] = useState<RevealStage>('idle');

  const handleGenerate = async () => {
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setData(null);
    setStage('idle');

    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: query.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Request failed');
      }

      const json: BriefData = await res.json();
      setData(json);

      // Sequential reveal
      for (const s of ['header', 'stock', 'snapshot', 'techstack', 'news', 'opening', 'pain', 'talking', 'done'] as RevealStage[]) {
        setStage(s);
        await delay(150);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuery('');
    setData(null);
    setStage('idle');
    setError(null);
  };

  const stageOrder: RevealStage[] = ['header', 'stock', 'snapshot', 'techstack', 'news', 'opening', 'pain', 'talking', 'done'];
  const isRevealed = (s: RevealStage) => stageOrder.indexOf(stage) >= stageOrder.indexOf(s);

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9' }}>
      <Navbar />

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px' }}>
        {/* ── Hero ──────────────────────────────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaaaaa',
            letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px 0',
          }}>
            // Sales Intelligence
          </p>
          <h2 style={{
            fontFamily: 'var(--font-geist)', fontSize: '26px', fontWeight: 500,
            letterSpacing: '-0.03em', color: '#1a1a1a', margin: 0,
          }}>
            Pre-call brief.{' '}
            <span style={{ color: '#aaaaaa', fontWeight: 300 }}>Generated in seconds.</span>
          </h2>
        </div>

        {/* ── Search ────────────────────────────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <SearchBox value={query} onChange={setQuery} onSubmit={handleGenerate} loading={loading} />
        </div>

        {/* ── Error ─────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
            padding: '12px 16px', marginBottom: '20px',
            fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        {/* ── Loading skeletons ─────────────────────────────── */}
        {loading && (
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
            <div style={{ height: '10px' }} />
            <SkeletonCard height={160} rows={4} />
          </div>
        )}

        {/* ── Results ───────────────────────────────────────── */}
        {!loading && data && (
          <div>
            {/* Company header */}
            {isRevealed('header') && (
              <div className="card-reveal">
                <CompanyHeader
                  company={data.company}
                  fetchedAt={data.fetchedAt}
                  ticker={data.stock?.symbol ?? null}
                  snapshot={data.snapshot}
                />
              </div>
            )}

            {/* Row 1: Stock + Snapshot */}
            {isRevealed('stock') && (
              <div className="card-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <StockCard
                  stock={data.stock}
                  isPrivate={data.stockError?.reason === 'not_found' || data.stockError?.reason === 'private'}
                />
                {isRevealed('snapshot') && <SnapshotCard snapshot={data.snapshot} />}
              </div>
            )}

            {/* Row 2: Tech Stack + Red Flags */}
            {isRevealed('techstack') && (
              <div className="card-reveal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <TechStackCard likely={data.techStack.likely} source={data.techStack.source} />
                <RedFlagsCard flags={data.redFlags} />
              </div>
            )}

            {/* Row 3: News (full width) */}
            {isRevealed('news') && (
              <div className="card-reveal" style={{ marginBottom: '10px' }}>
                <NewsCard articles={data.news.articles} error={data.news.error} />
              </div>
            )}

            {/* Row 4: Opening line (full width — the money card) */}
            {isRevealed('opening') && (
              <div className="card-reveal" style={{ marginBottom: '10px' }}>
                <OpeningLineCard line={data.openingLine} />
              </div>
            )}

            {/* Row 5: Pain Signals (full width) */}
            {isRevealed('pain') && (
              <div className="card-reveal" style={{ marginBottom: '10px' }}>
                <PainSignalsCard signals={data.painSignals} />
              </div>
            )}

            {/* Row 6: Talking Points (full width) */}
            {isRevealed('talking') && (
              <div className="card-reveal" style={{ marginBottom: '24px' }}>
                <TalkingPointsCard points={data.talkingPoints} />
              </div>
            )}

            {/* Bottom row */}
            {isRevealed('done') && (
              <div className="card-reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                <span style={{
                  fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em',
                }}>
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
                  <button onClick={handleReset} style={{
                    fontFamily: 'var(--font-geist-mono)', fontSize: '10px', letterSpacing: '0.1em',
                    padding: '4px 10px', border: '1px solid #e8e8e4', borderRadius: '4px',
                    background: 'transparent', color: '#888888', cursor: 'pointer',
                  }}>
                    [ new target ]
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

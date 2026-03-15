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
import SkeletonCard from '@/components/SkeletonCard';

// Which cards have been revealed (in order)
type RevealStage = 'idle' | 'header' | 'stock' | 'snapshot' | 'news' | 'talking' | 'done';

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
  talkingPoints: [string, string, string];
}

// Delay helper for staged reveal
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

      // Sequential reveal with 150ms gaps
      setStage('header');
      await delay(150);
      setStage('stock');
      await delay(150);
      setStage('snapshot');
      await delay(150);
      setStage('news');
      await delay(150);
      setStage('talking');
      await delay(150);
      setStage('done');
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

  const stageOrder: RevealStage[] = ['header', 'stock', 'snapshot', 'news', 'talking', 'done'];
  const isRevealed = (s: RevealStage) => stageOrder.indexOf(stage) >= stageOrder.indexOf(s);

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9' }}>
      <Navbar />

      {/* Main content */}
      <main
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '32px 24px',
        }}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: '10px',
              color: '#aaaaaa',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 10px 0',
            }}
          >
            // Sales Intelligence
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-geist)',
              fontSize: '26px',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              color: '#1a1a1a',
              margin: 0,
            }}
          >
            Pre-call brief.{' '}
            <span style={{ color: '#aaaaaa', fontWeight: 300 }}>Generated in seconds.</span>
          </h2>
        </div>

        {/* ── Search box ───────────────────────────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <SearchBox
            value={query}
            onChange={setQuery}
            onSubmit={handleGenerate}
            loading={loading}
          />
        </div>

        {/* ── Error state ──────────────────────────────────────── */}
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontFamily: 'var(--font-geist-mono)',
              fontSize: '12px',
              color: '#dc2626',
            }}
          >
            {error}
          </div>
        )}

        {/* ── Loading skeletons ─────────────────────────────────── */}
        {loading && (
          <div>
            <SkeletonCard height={70} rows={2} />
            <div style={{ height: '10px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <SkeletonCard height={160} rows={4} />
              <SkeletonCard height={160} rows={5} />
            </div>
            <div style={{ height: '10px' }} />
            <SkeletonCard height={140} rows={4} />
            <div style={{ height: '10px' }} />
            <SkeletonCard height={120} rows={3} />
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────── */}
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
              <div
                className="card-reveal"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}
              >
                <StockCard
                  stock={data.stock}
                  isPrivate={data.stockError?.reason === 'not_found' || data.stockError?.reason === 'private'}
                />
                {isRevealed('snapshot') && <SnapshotCard snapshot={data.snapshot} />}
              </div>
            )}

            {/* Row 2: News */}
            {isRevealed('news') && (
              <div className="card-reveal" style={{ marginBottom: '10px' }}>
                <NewsCard articles={data.news.articles} error={data.news.error} />
              </div>
            )}

            {/* Row 3: Talking points */}
            {isRevealed('talking') && (
              <div className="card-reveal" style={{ marginBottom: '24px' }}>
                <TalkingPointsCard points={data.talkingPoints} />
              </div>
            )}

            {/* Bottom row */}
            {isRevealed('done') && (
              <div
                className="card-reveal"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '8px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-geist-mono)',
                    fontSize: '10px',
                    color: '#cccccc',
                    letterSpacing: '0.05em',
                  }}
                >
                  powered by claude + newsapi + finnhub
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['[ export pdf ]', '[ copy ]'] as const).map(label => (
                    <button
                      key={label}
                      style={{
                        fontFamily: 'var(--font-geist-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.1em',
                        padding: '4px 10px',
                        border: '1px solid #e8e8e4',
                        borderRadius: '4px',
                        background: 'transparent',
                        color: '#888888',
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={handleReset}
                    style={{
                      fontFamily: 'var(--font-geist-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      padding: '4px 10px',
                      border: '1px solid #e8e8e4',
                      borderRadius: '4px',
                      background: 'transparent',
                      color: '#888888',
                      cursor: 'pointer',
                    }}
                  >
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

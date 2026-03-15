// StockCard — displays live stock price, change, and 10-bar sparkline

import type { StockQuote } from '@/lib/alphaVantage';

interface StockCardProps {
  stock: StockQuote | null;
  isPrivate?: boolean;
}

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const maxIdx = data.indexOf(max);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '3px',
        height: '40px',
        marginTop: '12px',
      }}
    >
      {data.map((val, i) => {
        const heightPct = ((val - min) / range) * 80 + 20; // min 20%, max 100%
        const isMax = i === maxIdx;
        const isMid = val > (min + (max - min) / 2);

        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${heightPct}%`,
              borderRadius: '2px',
              background: isMax ? '#1a1a1a' : isMid ? '#999' : '#f0f0ec',
              transition: 'height 0.3s',
            }}
          />
        );
      })}
    </div>
  );
}

export default function StockCard({ stock, isPrivate }: StockCardProps) {
  const isPositive = stock ? stock.change >= 0 : false;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e8e8e4',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          stock
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          finnhub
        </span>
      </div>

      {/* Private company */}
      {isPrivate && (
        <div style={{ paddingTop: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-geist-mono)',
              fontSize: '10px',
              letterSpacing: '0.1em',
              padding: '3px 10px',
              borderRadius: '4px',
              border: '1px solid #e8e8e4',
              color: '#888888',
              background: '#fafaf9',
            }}
          >
            [ PRIVATE COMPANY ]
          </span>
          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#cccccc', marginTop: '8px' }}>
            No public market data available
          </p>
        </div>
      )}

      {/* Stock data */}
      {stock && !isPrivate && (
        <>
          {/* Symbol + price */}
          <div>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#999', letterSpacing: '0.05em' }}>
              {stock.symbol} ·
            </span>
            <div
              style={{
                fontFamily: 'var(--font-geist-mono)',
                fontSize: '24px',
                fontWeight: 500,
                color: '#1a1a1a',
                marginTop: '4px',
              }}
            >
              ${stock.price.toFixed(2)}
            </div>

            {/* Change */}
            <div
              style={{
                fontFamily: 'var(--font-geist-mono)',
                fontSize: '11px',
                color: isPositive ? '#16a34a' : '#dc2626',
                marginTop: '2px',
              }}
            >
              {isPositive ? '+' : ''}{stock.change.toFixed(2)} ({isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%)
            </div>
          </div>

          {/* Sparkline */}
          <Sparkline data={stock.sparkline} />

          {/* H/L + Volume */}
          <div style={{ marginTop: '10px', display: 'flex', gap: '16px' }}>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc' }}>
              H: ${stock.high.toFixed(2)}
            </span>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc' }}>
              L: ${stock.low.toFixed(2)}
            </span>
            <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc' }}>
              VOL: {stock.volume}
            </span>
          </div>
        </>
      )}

      {/* No data (not private, but no stock found) */}
      {!stock && !isPrivate && (
        <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#cccccc', paddingTop: '8px' }}>
          No stock data available
        </p>
      )}
    </div>
  );
}

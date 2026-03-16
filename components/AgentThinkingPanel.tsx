'use client';

import { useEffect, useRef } from 'react';

export interface AgentLog {
  type: 'thinking' | 'result';
  message: string;
}

interface AgentThinkingPanelProps {
  logs: AgentLog[];
  state: 'idle' | 'running' | 'complete' | 'error';
  elapsed: number; // seconds
}

export default function AgentThinkingPanel({ logs, state, elapsed }: AgentThinkingPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={{
      background: '#0d0d0d',
      border: '1px solid #222222',
      borderRadius: '6px',
      padding: '0',
      marginBottom: '20px',
      overflow: 'hidden',
    }}>
      {/* Terminal title bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 14px',
        borderBottom: '1px solid #1e1e1e',
        background: '#161616',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: state === 'running' ? '#f97316' : state === 'complete' ? '#16a34a' : '#dc2626',
            animation: state === 'running' ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontFamily: 'var(--font-geist-mono)',
            fontSize: '10px',
            color: state === 'running' ? '#f97316' : state === 'complete' ? '#16a34a' : '#dc2626',
            letterSpacing: '0.1em',
          }}>
            {state === 'running' ? '[ AGENT RUNNING ]' : state === 'complete' ? '[ BRIEF READY ]' : '[ ERROR ]'}
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '10px',
          color: '#333333',
          letterSpacing: '0.05em',
        }}>
          {elapsed}s
        </span>
      </div>

      {/* Log area */}
      <div style={{
        maxHeight: '180px',
        overflowY: 'auto',
        fontFamily: 'var(--font-geist-mono)',
        fontSize: '11px',
        padding: '12px 14px',
      }}>
        {logs.map((log, i) => (
          <div key={i} style={{
            padding: '2px 0',
            color: log.type === 'result' ? '#16a34a' : '#444444',
            lineHeight: '1.5',
          }}>
            <span style={{ color: log.type === 'result' ? '#16a34a' : '#2a2a2a', marginRight: '6px' }}>
              {log.type === 'result' ? '✓' : '›'}
            </span>
            {log.message}
          </div>
        ))}
        {logs.length === 0 && (
          <span style={{ color: '#2a2a2a' }}>_</span>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

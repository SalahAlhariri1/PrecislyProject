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
      background: '#ffffff',
      border: '1px solid #e8e8e4',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '20px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
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
            color: '#1a1a1a',
            letterSpacing: '0.1em',
          }}>
            {state === 'running' ? '[ AGENT RUNNING ]' : state === 'complete' ? '[ BRIEF READY ]' : '[ ERROR ]'}
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-geist-mono)',
          fontSize: '10px',
          color: '#cccccc',
          letterSpacing: '0.05em',
        }}>
          {elapsed}s
        </span>
      </div>

      {/* Log area */}
      <div style={{
        maxHeight: '200px',
        overflowY: 'auto',
        fontFamily: 'var(--font-geist-mono)',
        fontSize: '11px',
      }}>
        {logs.map((log, i) => (
          <div key={i} style={{
            padding: '3px 0',
            color: log.type === 'result' ? '#16a34a' : '#555555',
          }}>
            {log.type === 'result' ? '✓' : '→'} {log.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

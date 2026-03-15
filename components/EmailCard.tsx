// EmailCard — ready-to-send follow-up/cover email in code-block style (shared across all call types)

'use client';

import { useState } from 'react';

interface EmailCardProps {
  subject: string;
  body: string;
  label: string;  // e.g. "// send this after" or "// rfp cover email"
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold** → bold
    .replace(/^- \[ \]/gm, '•')            // - [ ] → •
    .replace(/^- /gm, '• ')                // - item → • item
    .replace(/\*(.+?)\*/g, '$1');           // *italic* → italic
}

export default function EmailCard({ subject, body, label }: EmailCardProps) {
  const [copied, setCopied] = useState(false);
  const cleanBody = stripMarkdown(body);

  const handleCopy = async () => {
    const text = `Subject: ${subject}\n\n${cleanBody}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback: do nothing */ }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#bbbbbb', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#cccccc', letterSpacing: '0.05em' }}>
          agent-generated
        </span>
      </div>

      <div style={{
        position: 'relative',
        background: '#f9f9f8',
        border: '1px solid #e8e8e4',
        borderRadius: '6px',
        padding: '16px',
      }}>
        {/* Copy button */}
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute', top: '10px', right: '10px',
            fontFamily: 'var(--font-geist-mono)', fontSize: '10px', letterSpacing: '0.1em',
            padding: '3px 8px', borderRadius: '4px',
            border: '1px solid #e8e8e4', background: copied ? '#f0fdf4' : '#fff',
            color: copied ? '#16a34a' : '#888888', cursor: 'pointer',
          }}
        >
          {copied ? '[ COPIED ✓ ]' : '[ COPY ]'}
        </button>

        {/* Subject */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#aaaaaa', letterSpacing: '0.05em' }}>
            SUBJECT:
          </span>
          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#1a1a1a', margin: '4px 0 0 0', lineHeight: 1.6 }}>
            {subject}
          </p>
        </div>

        {/* Body */}
        <div style={{ borderTop: '1px solid #e8e8e4', paddingTop: '12px' }}>
          <pre style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#1a1a1a',
            lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {cleanBody}
          </pre>
        </div>
      </div>
    </div>
  );
}

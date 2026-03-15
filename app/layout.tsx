import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Geist fonts are bundled by create-next-app
const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'brief.dev — Sales Intelligence',
  description: 'Pre-call briefs for Sales Engineers. Live stock data, recent news, and Claude-generated talking points.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body style={{ margin: 0, background: '#fafaf9', color: '#1a1a1a', fontFamily: 'var(--font-geist), sans-serif' }}>
        {children}
      </body>
    </html>
  );
}

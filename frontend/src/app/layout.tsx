import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import Announcements from '@/components/Announcements';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Aviator — Crash Game',
  description: 'Provably-fair multiplier crash game. Cash out before it flies away.',
};

export const viewport: Viewport = {
  themeColor: '#0a0a12',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>
          <Announcements />
          {children}
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { I18nProvider } from '@/lib/i18n';
import Announcements from '@/components/Announcements';
import Notifications from '@/components/Notifications';

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
        <I18nProvider>
          <Providers>
            <Announcements />
            <Notifications />
            {children}
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}

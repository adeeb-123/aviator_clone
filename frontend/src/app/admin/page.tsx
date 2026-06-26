'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Overview from '@/components/admin/Overview';
import Players from '@/components/admin/Players';
import Rounds from '@/components/admin/Rounds';
import Controls from '@/components/admin/Controls';
import Alerts from '@/components/admin/Alerts';
import Settings from '@/components/admin/Settings';
import Audit from '@/components/admin/Audit';
import Promos from '@/components/admin/Promos';
import Tournaments from '@/components/admin/Tournaments';
import { useAuth, useGame, useAlerts, useGameControl } from '@/lib/store';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { AdminAlert } from '@/types';

type Tab = 'overview' | 'players' | 'rounds' | 'alerts' | 'controls' | 'settings' | 'audit' | 'promos' | 'tournaments';

const sevBg = (s?: string) => (s === 'critical' ? 'bg-loss' : s === 'warning' ? 'bg-gold text-base-900' : 'bg-accent');

export default function AdminPage() {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const phase = useGame((s) => s.phase);
  const multiplier = useGame((s) => s.multiplier);
  const { unread, setAll, prepend, latest, clearLatest } = useAlerts();
  const forcedCount = useGameControl((s) => s.forcedCount);
  const [tab, setTab] = useState<Tab>('overview');
  const [toast, setToast] = useState<AdminAlert | null>(null);

  // initial load + real-time alert subscription
  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/admin/alerts', { params: { limit: 100 } }).then((r) => setAll(r.data.alerts, r.data.unread)).catch(() => {});
    const socket = getSocket();
    const onAlert = (a: AdminAlert) => prepend(a);
    socket.on('admin:alert', onAlert);
    return () => { socket.off('admin:alert', onAlert); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // transient toast for the newest alert
  useEffect(() => {
    if (!latest) return;
    setToast(latest);
    const id = setTimeout(() => { setToast(null); clearLatest(); }, 6000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest]);

  if (!loading && user && user.role !== 'admin') {
    return (
      <div className="min-h-screen">
        <Header />
        <p className="p-10 text-center text-loss">⛔ Admin access required.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview & Analytics', icon: '📊' },
    { id: 'players', label: 'Players', icon: '👥' },
    { id: 'rounds', label: 'Round Audit', icon: '🎲' },
    { id: 'alerts', label: 'Alerts', icon: '🔔', badge: unread },
    { id: 'controls', label: 'Game Controls', icon: '🎮', badge: forcedCount },
    { id: 'settings', label: 'Settings & Broadcast', icon: '⚙️' },
    { id: 'promos', label: 'Promo Codes', icon: '🎟️' },
    { id: 'tournaments', label: 'Tournaments', icon: '🏆' },
    { id: 'audit', label: 'Audit Log', icon: '📋' },
  ];

  return (
    <div className="min-h-screen">
      <Header />

      {/* live alert toast */}
      {toast && (
        <div className="fixed right-4 top-20 z-[200] max-w-sm animate-floaty">
          <div className={`glass border p-3 shadow-glow ${toast.severity === 'critical' ? 'border-loss/60' : 'border-gold/50'}`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/70">
              🔔 New alert <span className={`rounded px-1.5 py-0.5 text-[10px] text-white ${sevBg(toast.severity)}`}>{toast.severity}</span>
            </div>
            <p className="mt-1 text-sm text-white/90">{toast.message}</p>
            <button onClick={() => setTab('alerts')} className="mt-1 text-xs text-accent-glow hover:underline">view all alerts →</button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1400px] space-y-5 px-3 py-6 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">Admin Console</h1>
            <p className="text-sm text-white/40">Real-time analytics & operations</p>
          </div>
          <div className="glass flex items-center gap-2 px-4 py-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${phase === 'running' ? 'bg-win animate-pulse' : phase === 'crashed' ? 'bg-loss' : 'bg-gold'}`} />
            <span>Engine:</span>
            <span className="font-bold capitalize text-accent-glow">{phase}</span>
            <span className="text-white/30">·</span>
            <span className={`font-bold tabular-nums ${phase === 'crashed' ? 'text-loss' : phase === 'running' ? 'text-win' : 'text-white/60'}`}>
              {multiplier.toFixed(2)}x
            </span>
          </div>
        </div>

        {/* tabs */}
        <div className="flex flex-wrap gap-2 border-b border-white/10">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.id ? 'border-accent-glow text-white' : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {t.icon} {t.label}
              {t.badge ? <span className="rounded-full bg-loss px-1.5 py-0.5 text-[10px] font-bold text-white">{t.badge}</span> : null}
            </button>
          ))}
        </div>

        {tab === 'overview' && <Overview />}
        {tab === 'players' && <Players />}
        {tab === 'rounds' && <Rounds />}
        {tab === 'alerts' && <Alerts />}
        {tab === 'controls' && <Controls />}
        {tab === 'settings' && <Settings />}
        {tab === 'promos' && <Promos />}
        {tab === 'tournaments' && <Tournaments />}
        {tab === 'audit' && <Audit />}
      </main>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Overview from '@/components/admin/Overview';
import Players from '@/components/admin/Players';
import Rounds from '@/components/admin/Rounds';
import Controls from '@/components/admin/Controls';
import { useAuth, useGame } from '@/lib/store';

type Tab = 'overview' | 'players' | 'rounds' | 'controls';

export default function AdminPage() {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const phase = useGame((s) => s.phase);
  const [tab, setTab] = useState<Tab>('overview');

  if (!loading && user && user.role !== 'admin') {
    return (
      <div className="min-h-screen">
        <Header />
        <p className="p-10 text-center text-loss">⛔ Admin access required.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview & Analytics', icon: '📊' },
    { id: 'players', label: 'Players', icon: '👥' },
    { id: 'rounds', label: 'Round Audit', icon: '🎲' },
    { id: 'controls', label: 'Game Controls', icon: '🎮' },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black">Admin Console</h1>
            <p className="text-sm text-white/40">Real-time analytics & operations</p>
          </div>
          <div className="glass px-4 py-2 text-sm">
            Engine: <span className="font-bold capitalize text-accent-glow">{phase}</span>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-2 border-b border-white/10">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.id ? 'border-accent-glow text-white' : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <Overview />}
        {tab === 'players' && <Players />}
        {tab === 'rounds' && <Rounds />}
        {tab === 'controls' && <Controls />}
      </main>
    </div>
  );
}

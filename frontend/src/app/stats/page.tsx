'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { inrCompact } from '@/lib/format';
import type { PlayerStats, Badge, LevelInfo } from '@/types';

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass min-w-0 overflow-hidden p-4">
      <div className="truncate text-[11px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-1 truncate text-xl font-black tabular-nums sm:text-2xl ${tone ?? 'text-white'}`} title={value}>{value}</div>
    </div>
  );
}

export default function StatsPage() {
  const user = useAuth((s) => s.user);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [level, setLevel] = useState<LevelInfo | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/users/stats').then(({ data }) => { setStats(data.stats); setBadges(data.badges); setLevel(data.level); }).catch(() => setErr('Please log in to see your stats.'));
  }, []);

  const inr = inrCompact; // compact (₹1.2L / ₹5.3k) so big values never overflow the cards
  const earned = badges.filter((b) => b.earned).length;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">My Stats {user && <span className="text-white/40">· {user.username}</span>}</h1>
          <p className="text-sm text-white/40">Your lifetime performance and achievements.</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link href="/history" className="text-accent-glow hover:underline">📜 Full bet history →</Link>
            <Link href="/rewards" className="text-accent-glow hover:underline">🎁 Rewards →</Link>
          </div>
        </div>

        {err && <p className="text-loss">{err}</p>}
        {!stats && !err && <p className="text-white/40">Loading…</p>}

        {level && (
          <div className="glass p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-glow text-lg font-black">{level.level}</div>
                <div>
                  <div className="font-black">Level {level.level} · <span className="text-accent-glow">{level.title}</span></div>
                  <div className="text-xs text-white/40">{level.xp} XP {level.toNext > 0 ? `· ${level.toNext} to level ${level.level + 1}` : '· max level!'}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-base-700">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-glow transition-all" style={{ width: `${level.progressPct}%` }} />
            </div>
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Net Profit / Loss" value={inr(stats.netPL)} tone={stats.netPL >= 0 ? 'text-win' : 'text-loss'} />
              <Stat label="Win Rate" value={`${stats.winRate}%`} tone="text-accent-glow" />
              <Stat label="Total Bets" value={String(stats.bets)} />
              <Stat label="Wins / Losses" value={`${stats.wins} / ${stats.losses}`} />
              <Stat label="Total Wagered" value={inr(stats.wagered)} tone="text-accent-glow" />
              <Stat label="Total Won" value={inr(stats.won)} tone="text-win" />
              <Stat label="Biggest Multiplier" value={`${stats.biggestMultiplier}x`} tone="text-gold" />
              <Stat label="Biggest Win" value={inr(stats.biggestWin)} tone="text-gold" />
              <Stat label="Avg Bet" value={inr(stats.avgBet)} />
              <Stat label="Current Win Streak" value={`🔥 ${stats.winStreak}`} tone={stats.winStreak > 0 ? 'text-loss' : 'text-white'} />
            </div>

            <div className="glass p-5">
              <h2 className="mb-3 font-semibold">Achievements <span className="text-sm font-normal text-white/40">· {earned}/{badges.length} unlocked</span></h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {badges.map((b) => (
                  <div key={b.id} className={`rounded-xl border p-3 text-center transition ${b.earned ? 'border-gold/50 bg-gold/10' : 'border-white/5 bg-base-700/30 opacity-50'}`} title={b.hint}>
                    <div className="text-3xl">{b.earned ? b.icon : '🔒'}</div>
                    <div className="mt-1 text-sm font-bold">{b.label}</div>
                    <div className="text-[11px] text-white/40">{b.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

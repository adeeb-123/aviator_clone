'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import type { PublicProfile } from '@/types';

const VIP_ICON = ['🥉', '🥈', '🥇', '💎', '💠'];

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/users/profile/${username}`).then((r) => setP(r.data.profile)).catch(() => setErr('Player not found.'));
  }, [username]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl space-y-5 px-3 py-8 sm:px-4">
        {err && <p className="glass p-8 text-center text-white/50">{err}</p>}
        {p && (
          <>
            <div className="glass p-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-base-700 text-4xl">{p.avatar ?? '👤'}</div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-black">@{p.username}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent-glow">Lvl {p.level.level} · {p.level.title}</span>
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-gold">{VIP_ICON[p.vipTier] ?? '🥉'} VIP {p.vipTier}</span>
                    <span className="text-white/40">Joined {new Date(p.joinedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                  </div>
                  {p.bio && <p className="mt-2 text-sm text-white/60">{p.bio}</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total Bets" value={String(p.stats.bets)} />
              <Stat label="Wins" value={String(p.stats.wins)} tone="text-win" />
              <Stat label="Win Rate" value={`${p.stats.winRate}%`} tone="text-accent-glow" />
              <Stat label="Best Multiplier" value={`${p.stats.biggestMultiplier}x`} tone="text-gold" />
            </div>

            <div className="glass p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">Achievements · {p.badgeCount}</h2>
              {p.badges.length === 0 ? (
                <p className="text-sm text-white/30">No badges earned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {p.badges.map((b) => (
                    <span key={b.id} title={b.label} className="flex items-center gap-1 rounded-lg bg-gold/15 px-2.5 py-1 text-sm text-gold ring-1 ring-gold/30">{b.icon} {b.label}</span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass min-w-0 overflow-hidden p-4">
      <div className="truncate text-[11px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-1 truncate text-xl font-black tabular-nums ${tone ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

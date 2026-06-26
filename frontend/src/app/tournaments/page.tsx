'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { inr } from '@/lib/format';
import type { Tournament } from '@/types';

const fmtScore = (metric: string, v: number) =>
  metric === 'wins' ? `${v} wins` : metric === 'multiplier' ? `${v.toFixed(2)}x` : inr(v);

const timeLeft = (end: string) => {
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4);
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-win/20 text-win', scheduled: 'bg-gold/20 text-gold', ended: 'bg-base-700 text-white/50',
};

export default function TournamentsPage() {
  const user = useAuth((s) => s.user);
  const [list, setList] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tournaments').then((r) => setList(r.data.tournaments)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!user) {
    return <div className="min-h-screen"><Header /><p className="p-10 text-center text-white/50">Please log in to see tournaments.</p></div>;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl space-y-5 px-3 py-8 sm:px-4">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">🏆 Tournaments</h1>
          <p className="text-sm text-white/40">Compete on the leaderboard and win from the prize pool.</p>
        </div>

        {loading && <p className="text-white/40">Loading…</p>}
        {!loading && list.length === 0 && <p className="glass p-8 text-center text-white/40">No tournaments running right now — check back soon!</p>}

        {list.map((t) => (
          <section key={t._id} className="glass p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black">{t.name}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                </div>
                <p className="text-xs text-white/40">{t.metricLabel} · {t.status === 'scheduled' ? `starts ${new Date(t.startAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : t.status === 'active' ? timeLeft(t.endAt) : 'finished'}</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-white/40">Prize pool</div>
                <div className="text-xl font-black text-gold">{inr(t.prizePool ?? 0)}</div>
              </div>
            </div>

            {/* prize breakdown */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {t.prizes.map((p, i) => (
                <span key={i} className="rounded-lg bg-base-700/50 px-2 py-1">{['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`} {inr(p)}</span>
              ))}
            </div>

            {/* ended → winners; else live standings */}
            {t.status === 'ended' && t.winners.length > 0 ? (
              <div className="mt-4 space-y-1">
                <div className="text-xs font-bold uppercase tracking-widest text-white/40">Winners</div>
                {t.winners.map((w) => (
                  <div key={w.rank} className="flex items-center justify-between rounded-lg bg-base-700/30 px-3 py-1.5 text-sm">
                    <span>{['🥇', '🥈', '🥉'][w.rank - 1] ?? `#${w.rank}`} <b>@{w.username}</b> · {fmtScore(t.metric, w.score)}</span>
                    <span className="font-bold text-gold">{inr(w.prize)}</span>
                  </div>
                ))}
              </div>
            ) : t.standings && t.standings.length > 0 ? (
              <div className="mt-4 space-y-1">
                <div className="text-xs font-bold uppercase tracking-widest text-white/40">Live standings</div>
                {t.standings.map((s) => {
                  const me = s.username === user.username;
                  return (
                    <div key={s.userId} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${me ? 'bg-accent/20 ring-1 ring-accent' : 'bg-base-700/30'}`}>
                      <span>{['🥇', '🥈', '🥉'][s.rank - 1] ?? `#${s.rank}`} <b>@{s.username}</b>{me ? ' (you)' : ''}</span>
                      <span className="font-semibold tabular-nums">{fmtScore(t.metric, s.score)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/30">{t.status === 'scheduled' ? 'Standings open when it starts.' : 'No entries yet — place a bet to climb the board!'}</p>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}

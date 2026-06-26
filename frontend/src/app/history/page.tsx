'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { inr, dt } from '@/lib/format';
import type { BetHistoryItem } from '@/types';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'cashed-out', label: 'Wins' },
  { id: 'lost', label: 'Losses' },
] as const;

export default function HistoryPage() {
  const user = useAuth((s) => s.user);
  const [bets, setBets] = useState<BetHistoryItem[]>([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users/bets', { params: { page, limit: 20, status: status || undefined } })
      .then((r) => { setBets(r.data.bets); setPages(r.data.pages || 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, status]);
  useEffect(() => { load(); }, [load]);

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header />
        <p className="p-10 text-center text-white/50">Please log in to view your bet history.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl space-y-4 px-3 py-8 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black sm:text-3xl">Bet History</h1>
          <div className="flex gap-1 rounded-lg bg-base-700/60 p-0.5 text-xs">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => { setStatus(f.id); setPage(1); }} className={`rounded px-3 py-1.5 font-semibold ${status === f.id ? 'bg-accent text-white' : 'text-white/50'}`}>{f.label}</button>
            ))}
          </div>
        </div>

        <div className="glass overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                <th className="p-3">Round</th>
                <th className="p-3">Date</th>
                <th className="p-3 text-right">Bet</th>
                <th className="p-3 text-right">Cashed @</th>
                <th className="p-3 text-right">Payout</th>
                <th className="p-3 text-right">P/L</th>
                <th className="p-3 text-center">Verify</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b) => {
                const pl = (b.payout ?? 0) - b.amount;
                return (
                  <tr key={b._id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 font-mono text-white/60">#{b.roundId}</td>
                    <td className="p-3 text-white/60">{dt(b.createdAt)}</td>
                    <td className="p-3 text-right tabular-nums">{inr(b.amount)}</td>
                    <td className="p-3 text-right tabular-nums">{b.status === 'cashed-out' && b.cashoutMultiplier ? `${b.cashoutMultiplier.toFixed(2)}x` : '—'}</td>
                    <td className="p-3 text-right tabular-nums">{b.payout ? inr(b.payout) : '—'}</td>
                    <td className={`p-3 text-right font-bold tabular-nums ${pl >= 0 ? 'text-win' : 'text-loss'}`}>{pl >= 0 ? '+' : ''}{inr(pl)}</td>
                    <td className="p-3 text-center"><Link href="/fairness" className="text-accent-glow hover:underline">🔍</Link></td>
                  </tr>
                );
              })}
              {!loading && bets.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-white/40">No bets yet — go play a round!</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn bg-base-700 disabled:opacity-30">← Prev</button>
          <span className="text-white/50">Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn bg-base-700 disabled:opacity-30">Next →</button>
        </div>
      </main>
    </div>
  );
}

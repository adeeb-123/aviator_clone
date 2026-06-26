'use client';

import { useRef, useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { inr, num, dt } from '@/lib/format';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { downloadCSV } from '@/lib/csv';
import RefreshBar from './RefreshBar';

interface RoundRow {
  roundId: number; crashPoint: number; bets: number; wagered: number; payout: number; housePL: number;
  revealed: boolean; fairnessOk: boolean | null; serverSeedHash: string; endTime: string;
}

export default function Rounds() {
  const [rows, setRows] = useState<RoundRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const pageRef = useRef(page);
  pageRef.current = page;

  const load = async () => {
    const r = await api.get('/admin/analytics/rounds', { params: { page: pageRef.current, limit: 30 } });
    setRows(r.data.rounds);
    setPages(r.data.pages);
  };
  const { auto, setAuto, updatedAt, refresh } = useAutoRefresh(load, 15000);
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [page]);

  const tint = (m: number) => (m < 2 ? 'text-win' : m < 5 ? 'text-gold' : 'text-loss');
  const fairness = (r: RoundRow) =>
    !r.revealed
      ? <span className="text-white/40" title="Seed not yet revealed (committed hash only)">🔒 committed</span>
      : r.fairnessOk
        ? <span className="text-win" title="Recomputed crash matches the seed">✓ verified</span>
        : <span className="text-loss font-bold" title="Outcome does NOT match the seed (admin-forced / tampered)">✗ FORCED</span>;

  const exportCSV = () => downloadCSV('aviator-rounds.csv', rows.map((r) => ({
    round: r.roundId, crashPoint: r.crashPoint, bets: r.bets, wagered: r.wagered, payout: r.payout, housePL: r.housePL,
    fairness: !r.revealed ? 'committed' : r.fairnessOk ? 'verified' : 'FORCED', endTime: r.endTime,
  })));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Round audit <span className="text-xs font-normal text-white/40">— economics & provably-fair check per round</span></h3>
        <RefreshBar auto={auto} setAuto={setAuto} updatedAt={updatedAt} onRefresh={() => void refresh()}>
          <button onClick={exportCSV} className="rounded bg-base-600 px-2.5 py-1 font-semibold text-white/80 hover:bg-base-700">⬇ Export CSV</button>
        </RefreshBar>
      </div>

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-3 py-3">Round</th>
              <th className="px-3 py-3 text-right">Crash</th>
              <th className="px-3 py-3 text-right">Bets</th>
              <th className="px-3 py-3 text-right">Wagered</th>
              <th className="px-3 py-3 text-right">Payout</th>
              <th className="px-3 py-3 text-right">House P/L</th>
              <th className="px-3 py-3 text-center">Fairness</th>
              <th className="px-3 py-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-white/30">No rounds.</td></tr>}
            {rows.map((r) => (
              <tr key={r.roundId} className="border-b border-white/5 hover:bg-base-700/30">
                <td className="px-3 py-2.5 font-mono text-white/70">#{r.roundId}</td>
                <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${tint(r.crashPoint)}`}>{r.crashPoint.toFixed(2)}x</td>
                <td className="px-3 py-2.5 text-right text-white/60">{num(r.bets)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{inr(r.wagered)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{inr(r.payout)}</td>
                <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${r.housePL >= 0 ? 'text-win' : 'text-loss'}`}>{inr(r.housePL)}</td>
                <td className="px-3 py-2.5 text-center text-xs">{fairness(r)}</td>
                <td className="px-3 py-2.5 text-right text-xs text-white/40">{dt(r.endTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-3 text-sm">
        <button disabled={page <= 1} className="btn bg-base-600 px-3 py-1 text-white/80" onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
        <span className="text-white/50">Page {page} / {pages}</span>
        <button disabled={page >= pages} className="btn bg-base-600 px-3 py-1 text-white/80" onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
      </div>
    </div>
  );
}

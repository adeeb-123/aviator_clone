'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { inr, num, pct, dt } from '@/lib/format';
import PlayerDetail from './PlayerDetail';

interface Row {
  userId: string; username: string; email: string; role: string; isBanned: boolean; balance: number;
  wagered: number; won: number; playerPL: number; housePL: number; bets: number; wins: number; winRate: number;
  bestMultiplier: number; deposits: number; withdrawals: number; lastActiveAt: string;
}

const COLS: { key: string; label: string; money?: boolean; tone?: boolean }[] = [
  { key: 'balance', label: 'Balance', money: true },
  { key: 'wagered', label: 'Wagered', money: true },
  { key: 'won', label: 'Won', money: true },
  { key: 'playerPL', label: 'Player P/L', money: true, tone: true },
  { key: 'housePL', label: 'House P/L', money: true, tone: true },
  { key: 'bets', label: 'Bets' },
  { key: 'winRate', label: 'Win%' },
  { key: 'deposits', label: 'Deposits', money: true },
  { key: 'withdrawals', label: 'Withdrawals', money: true },
];

export default function Players() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('housePL');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/analytics/players', { params: { q, sort, dir, limit: 100 } })
      .then((r) => setRows(r.data.players))
      .finally(() => setLoading(false));
  }, [q, sort, dir]);

  useEffect(() => {
    const id = setTimeout(load, 250); // debounce search
    return () => clearTimeout(id);
  }, [load]);

  const toggleSort = (key: string) => {
    if (sort === key) setDir(dir === 'desc' ? 'asc' : 'desc');
    else { setSort(key); setDir('desc'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search username or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-xs text-white/40">{rows.length} players · sorted by {sort} {dir === 'desc' ? '↓' : '↑'}</span>
      </div>

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-3 py-3">Player</th>
              {COLS.map((c) => (
                <th key={c.key} className="cursor-pointer px-3 py-3 text-right hover:text-white" onClick={() => toggleSort(c.key)}>
                  {c.label}{sort === c.key ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
              <th className="px-3 py-3 text-right">Last active</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={12} className="px-3 py-6 text-center text-white/30">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={12} className="px-3 py-6 text-center text-white/30">No players.</td></tr>}
            {rows.map((r) => (
              <tr
                key={r.userId}
                onClick={() => setSelected(r.userId)}
                className="cursor-pointer border-b border-white/5 hover:bg-base-700/40"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white/90">{r.username}</span>
                    {r.role === 'admin' && <span className="text-[10px] text-gold">ADMIN</span>}
                    {r.isBanned && <span className="text-[10px] text-loss">BANNED</span>}
                  </div>
                  <div className="text-[11px] text-white/30">{r.email}</div>
                </td>
                {COLS.map((c) => {
                  const v = (r as unknown as Record<string, number>)[c.key];
                  const tone = c.tone ? (v >= 0 ? 'text-win' : 'text-loss') : 'text-white/80';
                  const display = c.money ? inr(v) : c.key === 'winRate' ? pct(v) : num(v);
                  return <td key={c.key} className={`px-3 py-2.5 text-right tabular-nums ${tone}`}>{display}</td>;
                })}
                <td className="px-3 py-2.5 text-right text-xs text-white/40">{dt(r.lastActiveAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/30">
        💡 <b>House P/L</b> = your profit/loss from that player (wagered − won). Positive = the house is ahead. Click a row for full activity.
      </p>

      {selected && <PlayerDetail userId={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

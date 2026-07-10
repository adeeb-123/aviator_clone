'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { inr, inrCompact, num, pct } from '@/lib/format';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { downloadCSV } from '@/lib/csv';
import RefreshBar from './RefreshBar';
import PlayerDetail from './PlayerDetail';
import Retention from './Retention';

interface Row {
  userId: string; username: string; email: string; avatar?: string; role: string; online: boolean;
  isBanned: boolean; isSuspended: boolean; muted: boolean; isNew: boolean; balance: number;
  wagered: number; won: number; playerPL: number; housePL: number; bets: number; wins: number; winRate: number;
  bestMultiplier: number; deposits: number; withdrawals: number; lastActiveAt: string; createdAt: string;
}
interface Summary {
  totalPlayers: number; onlineNow: number; activeToday: number; active7d: number; new7d: number; banned: number; muted: number;
  totalBalance: number; totalWagered: number; houseProfit: number; winningPlayers: number;
}

const COLS: { key: string; label: string; money?: boolean; tone?: boolean }[] = [
  { key: 'balance', label: 'Balance', money: true },
  { key: 'wagered', label: 'Wagered', money: true },
  { key: 'playerPL', label: 'Player P/L', money: true, tone: true },
  { key: 'housePL', label: 'House P/L', money: true, tone: true },
  { key: 'bets', label: 'Bets' },
  { key: 'winRate', label: 'Win%' },
  { key: 'deposits', label: 'Deposits', money: true },
  { key: 'withdrawals', label: 'Withdrawals', money: true },
];

function ago(d?: string): string {
  if (!d) return 'never';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}
const recencyTone = (d?: string) => {
  if (!d) return 'text-white/25';
  const h = (Date.now() - new Date(d).getTime()) / 3.6e6;
  return h < 24 ? 'text-win' : h < 168 ? 'text-white/60' : 'text-white/30';
};

const FILTERS = {
  active: [['all', 'Any activity'], ['today', 'Active today'], ['week', 'Active this week'], ['month', 'Active this month'], ['inactive', 'Inactive 30d+']],
  status: [['all', 'All statuses'], ['active', 'Active'], ['banned', 'Banned'], ['muted', 'Muted']],
  role: [['user', '👤 Players'], ['admin', '🛡️ Admins (house)']],
  segment: [['all', 'All players'], ['whales', '🐋 Whales (₹10k+ wagered)'], ['new', '✨ New (7d)'], ['winning', '⚠️ Ahead of house']],
} as const;

export default function Players() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState('all');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('user');
  const [segment, setSegment] = useState('all');
  const [sort, setSort] = useState('lastActiveAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<string | null>(null);
  const state = useRef({ q, sort, dir, active, status, role, segment });
  state.current = { q, sort, dir, active, status, role, segment };

  const load = async () => {
    const p = state.current;
    const r = await api.get('/admin/analytics/players', { params: { ...p, limit: 100 } });
    setRows(r.data.players); setSummary(r.data.summary);
  };
  const { auto, setAuto, updatedAt, refresh } = useAutoRefresh(load, 20000);

  useEffect(() => {
    const id = setTimeout(() => void refresh(), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, dir, active, status, role, segment]);

  const toggleSort = (key: string) => {
    if (sort === key) setDir(dir === 'desc' ? 'asc' : 'desc');
    else { setSort(key); setDir('desc'); }
  };

  const exportCSV = () =>
    downloadCSV('aviator-players.csv', rows.map((r) => ({
      username: r.username, email: r.email, role: r.role, balance: r.balance, wagered: r.wagered, won: r.won,
      playerPL: r.playerPL, housePL: r.housePL, bets: r.bets, winRate: r.winRate, deposits: r.deposits,
      withdrawals: r.withdrawals, banned: r.isBanned, muted: r.muted, lastActive: r.lastActiveAt, joined: r.createdAt,
    })));

  const Sel = ({ value, set, opts }: { value: string; set: (v: string) => void; opts: readonly (readonly [string, string])[] }) => (
    <select value={value} onChange={(e) => set(e.target.value)} className="input max-w-[190px] py-1.5 text-sm">
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      {/* summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Total players" value={num(summary.totalPlayers)} sub={`${summary.onlineNow} online now`} />
          <Kpi label="Online now" value={`🟢 ${num(summary.onlineNow)}`} tone="text-win" sub={`${summary.activeToday} active today`} />
          <Kpi label="New (7 days)" value={num(summary.new7d)} tone="text-accent-glow" />
          <Kpi label="Balance held" value={inrCompact(summary.totalBalance)} tone="text-gold" />
          <Kpi label="House profit" value={inrCompact(summary.houseProfit)} tone={summary.houseProfit >= 0 ? 'text-win' : 'text-loss'} />
          <Kpi label="Flags" value={`${summary.banned}🚫 ${summary.muted}🔇`} sub={`${summary.winningPlayers} ahead of house`} />
        </div>
      )}

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-[220px] py-1.5 text-sm" placeholder="Search username or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Sel value={active} set={setActive} opts={FILTERS.active} />
        <Sel value={status} set={setStatus} opts={FILTERS.status} />
        <Sel value={role} set={setRole} opts={FILTERS.role} />
        <Sel value={segment} set={setSegment} opts={FILTERS.segment} />
        <RefreshBar auto={auto} setAuto={setAuto} updatedAt={updatedAt} onRefresh={() => void refresh()}>
          <button onClick={exportCSV} className="rounded bg-base-600 px-2.5 py-1 font-semibold text-white/80 hover:bg-base-700">⬇ CSV</button>
          <span>{rows.length} shown</span>
        </RefreshBar>
      </div>

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-3 py-3">Player</th>
              {COLS.map((c) => (
                <th key={c.key} className="cursor-pointer px-3 py-3 text-right hover:text-white" onClick={() => toggleSort(c.key)}>
                  {c.label}{sort === c.key ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
              <th className="cursor-pointer px-3 py-3 text-right hover:text-white" onClick={() => toggleSort('lastActiveAt')}>
                Last active{sort === 'lastActiveAt' ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={11} className="px-3 py-6 text-center text-white/30">No players match these filters.</td></tr>}
            {rows.map((r) => (
              <tr key={r.userId} onClick={() => setSelected(r.userId)} className="cursor-pointer border-b border-white/5 hover:bg-base-700/40">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-base-700 text-sm">
                      {r.avatar ?? '👤'}
                      {r.online && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-base-900 bg-win" title="Online now" />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold text-white/90">{r.username}</span>
                        {r.role === 'admin' && <Badge tone="bg-gold/20 text-gold">ADMIN</Badge>}
                        {r.isNew && <Badge tone="bg-accent/20 text-accent-glow">NEW</Badge>}
                        {r.isBanned && <Badge tone="bg-loss/20 text-loss">BANNED</Badge>}
                        {r.muted && <Badge tone="bg-white/10 text-white/60">MUTED</Badge>}
                      </div>
                      <div className="truncate text-[11px] text-white/30">{r.email}</div>
                    </div>
                  </div>
                </td>
                {COLS.map((c) => {
                  const v = (r as unknown as Record<string, number>)[c.key];
                  const tone = c.tone ? (v >= 0 ? 'text-win' : 'text-loss') : 'text-white/80';
                  const display = c.money ? inr(v) : c.key === 'winRate' ? pct(v) : num(v);
                  return <td key={c.key} className={`px-3 py-2.5 text-right tabular-nums ${tone}`}>{display}</td>;
                })}
                <td className={`px-3 py-2.5 text-right text-xs tabular-nums ${recencyTone(r.lastActiveAt)}`}>{ago(r.lastActiveAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/30">
        💡 <b>House P/L</b> = your profit from that player (wagered − won). <b>Ahead of house</b> = players currently net-positive (watch for big withdrawals). Click a row to manage.
      </p>

      <Retention />

      {selected && <PlayerDetail userId={selected} onClose={() => setSelected(null)} onChanged={refresh} />}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="glass min-w-0 overflow-hidden p-3">
      <div className="truncate text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-black tabular-nums ${tone ?? 'text-white'}`}>{value}</div>
      {sub && <div className="truncate text-[10px] text-white/30">{sub}</div>}
    </div>
  );
}
function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${tone}`}>{children}</span>;
}

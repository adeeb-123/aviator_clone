'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '@/lib/api';
import { inr, inrCompact } from '@/lib/format';

interface Treasury {
  cash: { deposits: number; withdrawals: number; netCashIn: number; depositCount: number; withdrawCount: number };
  liabilities: { playerBalances: number; players: number; pendingWithdrawals: number; pendingCount: number };
  equity: number;
  gaming: { wagered: number; payout: number; ggr: number; rtp: number; rounds: number; ngr: number; bonuses: number; adminAdjust: number; refunds: number };
  byType: { type: string; total: number; count: number }[];
  daily: { date: string; deposits: number; withdrawals: number }[];
  topBalances: { username: string; balance: number }[];
}

const WIN = '#22d39a', LOSS = '#ef4444';
const TYPE_LABEL: Record<string, string> = { deposit: 'Deposits', withdraw: 'Withdrawals', bet: 'Bets', win: 'Wins paid', bonus: 'Bonuses', refund: 'Refunds', 'admin-adjust': 'Admin adjustments' };

export default function Treasury() {
  const [d, setD] = useState<Treasury | null>(null);
  useEffect(() => { api.get('/admin/treasury').then((r) => setD(r.data)).catch(() => {}); }, []);
  if (!d) return <p className="text-white/40">Loading…</p>;

  const equityPos = d.equity >= 0;

  return (
    <div className="space-y-5">
      {/* House equity hero */}
      <section className={`relative overflow-hidden rounded-2xl border p-6 ${equityPos ? 'border-win/40 bg-gradient-to-br from-win/15 via-base-800 to-base-900' : 'border-loss/40 bg-gradient-to-br from-loss/15 via-base-800 to-base-900'}`}>
        <div className="text-xs uppercase tracking-widest text-white/50">House equity (net worth from operations)</div>
        <div className={`mt-1 text-4xl font-black tabular-nums sm:text-5xl ${equityPos ? 'text-win' : 'text-loss'}`}>{inr(d.equity)}</div>
        <div className="mt-2 font-mono text-xs text-white/50">
          Net cash held ({inrCompact(d.cash.netCashIn)}) − player balances owed ({inrCompact(d.liabilities.playerBalances)}) = <b className={equityPos ? 'text-win' : 'text-loss'}>{inrCompact(d.equity)}</b>
        </div>
        <p className="mt-2 max-w-2xl text-xs text-white/40">
          What the house actually holds beyond what it owes players. Grows as players lose the house edge; shrinks when you pay bonuses or players run ahead. {equityPos ? 'Positive = solvent & profitable.' : 'Negative = you owe players more than you hold (usually from bonuses / lucky players in this sandbox).'}
        </p>
      </section>

      {/* cash + liabilities */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Deposits in" value={inrCompact(d.cash.deposits)} sub={`${d.cash.depositCount} txns`} tone="text-win" />
        <Kpi label="Withdrawals out" value={inrCompact(d.cash.withdrawals)} sub={`${d.cash.withdrawCount} txns`} tone="text-loss" />
        <Kpi label="Net cash held" value={inrCompact(d.cash.netCashIn)} sub="deposits − withdrawals" tone="text-white" />
        <Kpi label="Player balances owed" value={inrCompact(d.liabilities.playerBalances)} sub={`${d.liabilities.players} players`} tone="text-gold" />
        <Kpi label="Pending withdrawals" value={inrCompact(d.liabilities.pendingWithdrawals)} sub={`${d.liabilities.pendingCount} awaiting`} tone="text-accent-glow" />
      </div>

      {/* gaming performance */}
      <section className="glass p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">Gaming performance</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Total wagered" value={inrCompact(d.gaming.wagered)} sub={`${d.gaming.rounds} rounds`} />
          <Kpi label="Wins paid" value={inrCompact(d.gaming.payout)} tone="text-loss" />
          <Kpi label="GGR" value={inrCompact(d.gaming.ggr)} sub="wagered − payouts" tone={d.gaming.ggr >= 0 ? 'text-win' : 'text-loss'} />
          <Kpi label="Actual RTP" value={`${d.gaming.rtp}%`} tone="text-accent-glow" />
          <Kpi label="Bonuses given" value={inrCompact(d.gaming.bonuses)} sub="marketing cost" tone="text-gold" />
          <Kpi label="NGR" value={inrCompact(d.gaming.ngr)} sub="GGR − bonuses" tone={d.gaming.ngr >= 0 ? 'text-win' : 'text-loss'} />
        </div>
        <p className="mt-3 text-[11px] text-white/30">GGR = Gross Gaming Revenue (raw house win). NGR = Net Gaming Revenue after bonus costs — the closest thing to real profit.</p>
      </section>

      {/* cash flow chart */}
      <section className="glass p-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-white/40">Cash flow · last 30 days</h3>
        {d.daily.length === 0 ? <p className="py-8 text-center text-sm text-white/30">No deposit/withdrawal activity yet.</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.daily} margin={{ top: 5, right: 8, left: -6, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#ffffff66' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#ffffff55' }} width={48} tickFormatter={(v) => inrCompact(v)} />
              <Tooltip cursor={{ fill: '#ffffff0a' }} contentStyle={{ background: '#12121a', border: '1px solid #ffffff22', borderRadius: 8, fontSize: 12 }} formatter={(v: number, n: string) => [inr(v), n === 'deposits' ? 'Deposits' : 'Withdrawals']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deposits" fill={WIN} radius={[3, 3, 0, 0]} />
              <Bar dataKey="withdrawals" fill={LOSS} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* breakdown + watchlist */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">Money movement by type</h3>
          <div className="space-y-1 text-sm">
            {d.byType.map((t) => (
              <div key={t.type} className="flex items-center justify-between rounded-lg bg-base-700/30 px-3 py-1.5">
                <span className="text-white/60">{TYPE_LABEL[t.type] ?? t.type}</span>
                <span className="text-xs text-white/30">{t.count} txns</span>
                <span className={`w-28 text-right font-bold tabular-nums ${t.total >= 0 ? 'text-win' : 'text-loss'}`}>{t.total >= 0 ? '+' : '−'}{inr(Math.abs(t.total))}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass p-4">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-widest text-white/40">Largest balances</h3>
          <p className="mb-3 text-[11px] text-white/30">Biggest liabilities — watch these for large withdrawals.</p>
          <div className="space-y-1 text-sm">
            {d.topBalances.map((u, i) => (
              <div key={u.username} className="flex items-center justify-between rounded-lg bg-base-700/30 px-3 py-1.5">
                <span className="text-white/40">#{i + 1}</span>
                <span className="flex-1 truncate px-2 font-semibold">@{u.username}</span>
                <span className="font-bold tabular-nums text-gold">{inr(u.balance)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
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

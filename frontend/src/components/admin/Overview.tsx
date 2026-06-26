'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { api } from '@/lib/api';
import { inr, inrCompact, num, pct, dateShort } from '@/lib/format';

interface OverviewData {
  users: { total: number; admins: number; banned: number; newToday: number; newWeek: number; activeToday: number; playerBalances: number };
  financial: { wagered: number; payout: number; ggr: number; margin: number; wageredToday: number; deposits: number; withdrawals: number; netDeposits: number; bonusesPaid: number; adminAdjustments: number };
  game: { rounds: number; avgCrash: number; maxCrash: number; instaBust: number; instaBustRate: number; bets: number; betsToday: number; wins: number; winRate: number; uniqueBettors: number; online: number; phase: string };
  distribution: { range: string; count: number }[];
  txBreakdown: { type: string; count: number; sum: number }[];
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'win' | 'loss' | 'gold' | 'accent' }) {
  const color = tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : tone === 'gold' ? 'text-gold' : tone === 'accent' ? 'text-accent-glow' : 'text-white';
  return (
    <div className="glass p-4">
      <div className="text-[11px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

const BAR_COLORS = ['#ef4444', '#22d39a', '#22d39a', '#f5b50a', '#f5b50a', '#a855f7'];

export default function Overview() {
  const [ov, setOv] = useState<OverviewData | null>(null);
  const [series, setSeries] = useState<Record<string, number>[]>([]);
  const [days, setDays] = useState(30);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/admin/analytics/overview').then((r) => setOv(r.data)).catch(() => setErr('Failed to load analytics'));
  }, []);
  useEffect(() => {
    api.get('/admin/analytics/timeseries', { params: { days } }).then((r) => setSeries(r.data.series)).catch(() => {});
  }, [days]);

  if (err) return <p className="text-loss">{err}</p>;
  if (!ov) return <p className="text-white/40">Loading analytics…</p>;
  const { financial: f, game: g, users: u } = ov;

  return (
    <div className="space-y-5">
      {/* headline KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi label="House Profit (GGR)" value={inrCompact(f.ggr)} sub={`margin ${pct(f.margin)}`} tone={f.ggr >= 0 ? 'win' : 'loss'} />
        <Kpi label="Total Wagered" value={inrCompact(f.wagered)} sub={`${num(g.bets)} bets`} tone="accent" />
        <Kpi label="Total Paid Out" value={inrCompact(f.payout)} sub={`win rate ${pct(g.winRate)}`} />
        <Kpi label="Deposits" value={inrCompact(f.deposits)} sub={`net ${inrCompact(f.netDeposits)}`} tone="win" />
        <Kpi label="Withdrawals" value={inrCompact(f.withdrawals)} tone="loss" />
        <Kpi label="Player Balances" value={inrCompact(u.playerBalances)} sub="total liability" tone="gold" />
        <Kpi label="Users" value={num(u.total)} sub={`+${u.newWeek} this week · ${u.banned} banned`} />
        <Kpi label="Active Today" value={num(u.activeToday)} sub={`${g.online} betting now`} tone="accent" />
        <Kpi label="Rounds" value={num(g.rounds)} sub={`avg ${g.avgCrash}x`} />
        <Kpi label="Biggest Crash" value={`${num(g.maxCrash)}x`} tone="gold" />
        <Kpi label="Instant Busts" value={pct(g.instaBustRate)} sub={`${g.instaBust} @ 1.00x`} tone="loss" />
        <Kpi label="Wagered Today" value={inrCompact(f.wageredToday)} sub={`${g.betsToday} bets`} tone="accent" />
      </div>

      {/* financial time series */}
      <div className="glass p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Financial trend</h3>
          <div className="flex gap-1 text-xs">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={`rounded px-2 py-1 ${days === d ? 'bg-accent text-white' : 'text-white/50'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: -10 }}>
              <defs>
                <linearGradient id="gWager" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient>
                <linearGradient id="gPay" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d39a" stopOpacity={0.5} /><stop offset="100%" stopColor="#22d39a" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={dateShort} stroke="#888" fontSize={11} />
              <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => inrCompact(v)} width={60} />
              <Tooltip contentStyle={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} formatter={(v: number) => inr(v)} labelFormatter={dateShort} />
              <Area type="monotone" dataKey="wagered" stroke="#a855f7" fill="url(#gWager)" strokeWidth={2} name="Wagered" />
              <Area type="monotone" dataKey="payout" stroke="#ef4444" fill="url(#gPay)" strokeWidth={2} name="Payout" />
              <Area type="monotone" dataKey="profit" stroke="#22d39a" fill="url(#gProfit)" strokeWidth={2} name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex gap-4 text-xs text-white/50">
          <span>🟣 Wagered</span><span>🔴 Payout</span><span>🟢 House profit</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* crash distribution */}
        <div className="glass p-4">
          <h3 className="mb-3 font-semibold">Crash distribution ({num(g.rounds)} rounds)</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ov.distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="range" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} width={40} />
                <Tooltip contentStyle={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {ov.distribution.map((_, i) => <Cell key={i} fill={BAR_COLORS[i] ?? '#a855f7'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* transaction breakdown */}
        <div className="glass p-4">
          <h3 className="mb-3 font-semibold">Transaction breakdown</h3>
          <div className="space-y-2">
            {ov.txBreakdown.map((t) => (
              <div key={t.type} className="flex items-center justify-between rounded-lg bg-base-700/40 px-3 py-2 text-sm">
                <span className="capitalize text-white/70">{t.type}</span>
                <span className="text-xs text-white/40">{num(t.count)} txns</span>
                <span className={`font-bold ${t.sum >= 0 ? 'text-win' : 'text-loss'}`}>{inr(t.sum)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

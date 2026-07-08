'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { inr, inrCompact, dt } from '@/lib/format';
import type { PlayerStats, LevelInfo, VipTier, BetHistoryItem } from '@/types';

interface Dashboard {
  profile: { username: string; avatar?: string; bio?: string; balance: number; joinedAt: string; dailyStreak: number; referralCode: string; level: LevelInfo; vipTier: VipTier };
  stats: PlayerStats;
  vip: { tier: VipTier; next: VipTier | null; progressPct: number; toNext: number; wagered: number };
  outcome: { wins: number; losses: number };
  plChart: { n: number; pl: number; cum: number }[];
  daily: { date: string; wagered: number; won: number; net: number; bets: number }[];
  badgesEarned: number;
  totalBadges: number;
  recentBets: BetHistoryItem[];
  recentTx: { _id: string; type: string; amount: number; balanceAfter: number; description: string; createdAt: string }[];
}

const WIN = '#22d39a', LOSS = '#ef4444', ACCENT = '#8b5cf6', GOLD = '#f5b50a';
const TX_ICON: Record<string, string> = { deposit: '⬇️', withdraw: '⬆️', bet: '🎲', win: '🏆', bonus: '🎁', refund: '↩️', 'admin-adjust': '🛠️' };

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const [d, setD] = useState<Dashboard | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/users/dashboard').then((r) => setD(r.data)).catch(() => setErr('Please log in to see your dashboard.'));
  }, [user?.balance]);

  if (err) return <div className="min-h-screen"><Header /><p className="p-10 text-center text-white/50">{err}</p></div>;
  if (!d) return <div className="min-h-screen"><Header /><p className="p-10 text-center text-white/40">Loading…</p></div>;

  const { profile: p, stats: s } = d;
  const plColor = (d.plChart.at(-1)?.cum ?? 0) >= 0 ? WIN : LOSS;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl space-y-5 px-3 py-8 sm:px-4">
        {/* profile hero */}
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-accent/20 via-base-800 to-base-900 p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-base-900/60 text-4xl">{p.avatar ?? '👤'}</div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black sm:text-3xl">@{p.username}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent-glow">⭐ Lvl {p.level.level} · {p.level.title}</span>
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-gold">{p.vipTier.icon} {p.vipTier.name}</span>
                <span className="rounded-full bg-base-900/60 px-2 py-0.5 text-white/50">🔥 {p.dailyStreak}d streak</span>
                <span className="text-white/40">Member since {new Date(p.joinedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-white/40">Balance</div>
              <div className="text-3xl font-black tabular-nums text-win">{inr(p.balance)}</div>
              <Link href="/wallet" className="text-xs text-accent-glow hover:underline">Manage wallet →</Link>
            </div>
          </div>
          {/* quick links */}
          <div className="relative mt-4 flex flex-wrap gap-2">
            {[['/rewards', '🎁 Rewards'], ['/tournaments', '🏆 Tournaments'], ['/history', '📜 History'], ['/stats', '📊 Full stats'], ['/profile', '✏️ Edit profile']].map(([href, label]) => (
              <Link key={href} href={href} className="rounded-lg border border-white/10 bg-base-900/40 px-3 py-1.5 text-xs text-white/70 hover:border-accent/50 hover:text-white">{label}</Link>
            ))}
          </div>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Net P/L" value={inrCompact(s.netPL)} tone={s.netPL >= 0 ? 'text-win' : 'text-loss'} />
          <Kpi label="Win Rate" value={`${s.winRate}%`} tone="text-accent-glow" />
          <Kpi label="Total Bets" value={String(s.bets)} />
          <Kpi label="Wagered" value={inrCompact(s.wagered)} />
          <Kpi label="Biggest Win" value={inrCompact(s.biggestWin)} tone="text-gold" />
          <Kpi label="Win Streak" value={`🔥 ${s.winStreak}`} />
        </div>

        {/* progression */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Progress title={`Level ${p.level.level} · ${p.level.title}`} sub={p.level.toNext > 0 ? `${p.level.toNext} XP to level ${p.level.level + 1}` : 'Max level'} pct={p.level.progressPct} from="from-accent" to="to-accent-glow" />
          <Progress title={`${d.vip.tier.icon} ${d.vip.tier.name} tier`} sub={d.vip.next ? `${inrCompact(d.vip.toNext)} wagered to ${d.vip.next.name}` : 'Top tier reached'} pct={d.vip.progressPct} from="from-gold/70" to="to-gold" />
        </div>

        {/* charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="glass p-4 lg:col-span-2">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-white/40">Cumulative profit / loss</h2>
            {d.plChart.length === 0 ? <Empty text="Place some bets to see your P/L curve." /> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={d.plChart} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                  <defs><linearGradient id="pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={plColor} stopOpacity={0.4} /><stop offset="100%" stopColor={plColor} stopOpacity={0} /></linearGradient></defs>
                  <XAxis dataKey="n" hide />
                  <YAxis tick={{ fontSize: 11, fill: '#ffffff55' }} width={44} tickFormatter={(v) => inrCompact(v)} />
                  <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #ffffff22', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [inr(v), 'Cumulative P/L']} labelFormatter={() => ''} />
                  <Area type="monotone" dataKey="cum" stroke={plColor} strokeWidth={2} fill="url(#pl)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="glass p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-white/40">Win / loss</h2>
            {s.bets === 0 ? <Empty text="No bets yet." /> : (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="55%" height={140}>
                  <PieChart>
                    <Pie data={[{ name: 'Wins', value: d.outcome.wins }, { name: 'Losses', value: d.outcome.losses }]} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={3} stroke="none">
                      <Cell fill={WIN} /><Cell fill={LOSS} />
                    </Pie>
                    <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #ffffff22', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 text-sm">
                  <div><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: WIN }} /> {d.outcome.wins} wins</div>
                  <div><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: LOSS }} /> {d.outcome.losses} losses</div>
                  <div className="text-xs text-white/40">{s.winRate}% win rate</div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* 7-day activity */}
        <section className="glass p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-white/40">Last 7 days · net result</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d.daily} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#ffffff77' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#ffffff55' }} width={44} tickFormatter={(v) => inrCompact(v)} />
              <Tooltip cursor={{ fill: '#ffffff0a' }} contentStyle={{ background: '#12121a', border: '1px solid #ffffff22', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [inr(v), 'Net']} />
              <Bar dataKey="net" radius={[4, 4, 0, 0]}>{d.daily.map((day, i) => <Cell key={i} fill={day.net >= 0 ? WIN : LOSS} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* recent activity */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass p-4">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-widest text-white/40">Recent bets</h2><Link href="/history" className="text-xs text-accent-glow hover:underline">All →</Link></div>
            <div className="space-y-1">
              {d.recentBets.length === 0 && <Empty text="No bets yet." />}
              {d.recentBets.map((b) => {
                const pl = (b.payout ?? 0) - b.amount;
                return (
                  <div key={b._id} className="flex items-center justify-between rounded-lg bg-base-700/30 px-3 py-1.5 text-sm">
                    <span className="font-mono text-white/40">#{b.roundId}</span>
                    <span className="tabular-nums">{inr(b.amount)}</span>
                    <span className={b.status === 'cashed-out' ? 'text-win' : 'text-white/30'}>{b.status === 'cashed-out' && b.cashoutMultiplier ? `${b.cashoutMultiplier.toFixed(2)}x` : 'lost'}</span>
                    <span className={`w-20 text-right font-bold tabular-nums ${pl >= 0 ? 'text-win' : 'text-loss'}`}>{pl >= 0 ? '+' : '−'}{inr(Math.abs(pl))}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass p-4">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-widest text-white/40">Recent transactions</h2><Link href="/wallet" className="text-xs text-accent-glow hover:underline">Wallet →</Link></div>
            <div className="space-y-1">
              {d.recentTx.length === 0 && <Empty text="No transactions yet." />}
              {d.recentTx.map((t) => (
                <div key={t._id} className="flex items-center gap-2 rounded-lg bg-base-700/30 px-3 py-1.5 text-sm">
                  <span>{TX_ICON[t.type] ?? '•'}</span>
                  <span className="flex-1 truncate capitalize text-white/60">{t.type.replace('-', ' ')}</span>
                  <span className={`font-bold tabular-nums ${t.amount >= 0 ? 'text-win' : 'text-loss'}`}>{t.amount >= 0 ? '+' : '−'}{inr(Math.abs(t.amount))}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <p className="text-center text-xs text-white/30">🏅 {d.badgesEarned}/{d.totalBadges} achievements unlocked · <Link href="/stats" className="text-accent-glow hover:underline">view all</Link></p>
      </main>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass min-w-0 overflow-hidden p-3">
      <div className="truncate text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-black tabular-nums ${tone ?? 'text-white'}`}>{value}</div>
    </div>
  );
}
function Progress({ title, sub, pct, from, to }: { title: string; sub: string; pct: number; from: string; to: string }) {
  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between text-sm"><span className="font-bold">{title}</span><span className="text-xs text-white/40">{sub}</span></div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-base-700"><div className={`h-full rounded-full bg-gradient-to-r ${from} ${to}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm text-white/30">{text}</p>; }

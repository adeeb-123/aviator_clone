'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';

interface Data {
  signups: { date: string; count: number }[];
  newLast7: number;
  newLast30: number;
  retention: { d1: number; d7: number; cohort1: number; cohort7: number };
}

export default function Retention() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { api.get('/admin/analytics/retention').then((r) => setD(r.data)).catch(() => {}); }, []);
  if (!d) return null;

  return (
    <section className="glass p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">📈 Growth & retention</h3>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="New players (7d)" value={String(d.newLast7)} tone="text-accent-glow" />
        <Kpi label="New players (30d)" value={String(d.newLast30)} />
        <Kpi label="Day-1 retention" value={`${d.retention.d1}%`} sub={`${d.retention.cohort1}-player cohort`} tone="text-win" />
        <Kpi label="Day-7 retention" value={`${d.retention.d7}%`} sub={`${d.retention.cohort7}-player cohort`} tone="text-gold" />
      </div>
      <div className="mb-1 text-xs text-white/40">Signups per day · last 30 days</div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={d.signups} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#ffffff55' }} interval={4} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#ffffff55' }} allowDecimals={false} width={28} />
          <Tooltip cursor={{ fill: '#ffffff0a' }} contentStyle={{ background: '#12121a', border: '1px solid #ffffff22', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v, 'Signups']} />
          <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[11px] text-white/30">Retention = % of new players who placed a bet 1 day (D1) / within 7 days (D7) after signing up. Only cohorts old enough to measure are counted.</p>
    </section>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-base-900/40 p-3">
      <div className="truncate text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-0.5 truncate text-xl font-black tabular-nums ${tone ?? 'text-white'}`}>{value}</div>
      {sub && <div className="truncate text-[10px] text-white/30">{sub}</div>}
    </div>
  );
}

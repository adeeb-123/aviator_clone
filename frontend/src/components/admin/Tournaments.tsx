'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { inr, dt } from '@/lib/format';
import type { Tournament } from '@/types';

const METRICS = [
  { id: 'wagered', label: 'Most wagered' },
  { id: 'profit', label: 'Highest profit' },
  { id: 'wins', label: 'Most wins' },
  { id: 'multiplier', label: 'Biggest multiplier' },
] as const;

// default: starts now, ends in 24h (datetime-local format)
const localDt = (offsetH: number) => {
  const d = new Date(Date.now() + offsetH * 3.6e6 - new Date().getTimezoneOffset() * 6e4);
  return d.toISOString().slice(0, 16);
};

export default function Tournaments() {
  const [list, setList] = useState<Tournament[]>([]);
  const [name, setName] = useState('');
  const [metric, setMetric] = useState('wagered');
  const [startAt, setStartAt] = useState(localDt(0));
  const [endAt, setEndAt] = useState(localDt(24));
  const [prizes, setPrizes] = useState('500, 300, 200');
  const [msg, setMsg] = useState('');

  const load = () => api.get('/admin/tournaments').then((r) => setList(r.data.tournaments)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setMsg('');
    try {
      await api.post('/admin/tournaments', {
        name, metric,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        prizes: prizes.split(',').map((p) => Number(p.trim())).filter((n) => n > 0),
      });
      setName(''); setMsg('✓ Tournament created'); load();
    } catch (e: unknown) { setMsg((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not create'); }
  };
  const end = async (id: string) => { if (confirm('End now and pay out winners?')) { await api.post(`/admin/tournaments/${id}/end`).catch(() => {}); load(); } };
  const del = async (id: string) => { if (confirm('Delete this tournament?')) { await api.delete(`/admin/tournaments/${id}`).catch(() => {}); load(); } };

  return (
    <div className="space-y-5">
      <div className="glass p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">🏆 Create tournament</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs text-white/50">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend Wager Race" className="input" /></label>
          <label className="block"><span className="mb-1 block text-xs text-white/50">Metric</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="input">{METRICS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs text-white/50">Prizes (₹, comma-separated by rank)</span>
            <input value={prizes} onChange={(e) => setPrizes(e.target.value)} placeholder="500, 300, 200" className="input" /></label>
          <label className="block"><span className="mb-1 block text-xs text-white/50">Starts</span>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="input" /></label>
          <label className="block"><span className="mb-1 block text-xs text-white/50">Ends</span>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="input" /></label>
        </div>
        <button onClick={create} className="btn-primary mt-3">Create tournament</button>
        {msg && <p className="mt-2 text-sm text-accent-glow">{msg}</p>}
      </div>

      <div className="glass overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="p-3">Name</th><th className="p-3">Metric</th><th className="p-3 text-right">Pool</th>
              <th className="p-3">Window</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t._id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-semibold">{t.name}</td>
                <td className="p-3 text-white/60">{t.metric}</td>
                <td className="p-3 text-right tabular-nums text-gold">{inr(t.prizePool ?? 0)}</td>
                <td className="p-3 text-xs text-white/50">{dt(t.startAt)} → {dt(t.endAt)}</td>
                <td className="p-3 text-center"><span className={`text-xs ${t.status === 'active' ? 'text-win' : t.status === 'scheduled' ? 'text-gold' : 'text-white/40'}`}>{t.status}{t.paidOut ? ' · paid' : ''}</span></td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-1">
                    {!t.paidOut && <button onClick={() => end(t._id)} className="rounded bg-win/80 px-2 py-1 text-xs text-white hover:bg-win">End & pay</button>}
                    {!t.paidOut && <button onClick={() => del(t._id)} className="rounded bg-base-600 px-2 py-1 text-xs hover:bg-loss">Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-white/40">No tournaments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

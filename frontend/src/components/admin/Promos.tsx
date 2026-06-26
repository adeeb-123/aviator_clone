'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { inr, dt } from '@/lib/format';
import type { PromoCodeRow } from '@/types';

export default function Promos() {
  const [promos, setPromos] = useState<PromoCodeRow[]>([]);
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState(100);
  const [maxUses, setMaxUses] = useState(0);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/admin/promos').then((r) => setPromos(r.data.promos)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setMsg('');
    try {
      await api.post('/admin/promos', { code: code.trim().toUpperCase(), amount, maxUses });
      setCode(''); setMsg('✓ Code created'); load();
    } catch (e: unknown) { setMsg((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not create'); }
  };
  const toggle = async (p: PromoCodeRow) => { await api.patch(`/admin/promos/${p._id}`, { active: !p.active }).catch(() => {}); load(); };

  return (
    <div className="space-y-5">
      <div className="glass p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">🎟️ Create promo code</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block"><span className="mb-1 block text-xs text-white/50">Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME50" className="input font-mono uppercase" /></label>
          <label className="block"><span className="mb-1 block text-xs text-white/50">Amount (₹)</span>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input" /></label>
          <label className="block"><span className="mb-1 block text-xs text-white/50">Max uses (0 = ∞)</span>
            <input type="number" min={0} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className="input" /></label>
          <div className="flex items-end"><button onClick={create} className="btn-primary w-full">Create</button></div>
        </div>
        {msg && <p className="mt-2 text-sm text-accent-glow">{msg}</p>}
        <p className="mt-2 text-[11px] text-white/30">Each code can be redeemed once per player from the Rewards page.</p>
      </div>

      <div className="glass overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="p-3">Code</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Uses</th>
              <th className="p-3 text-center">Status</th><th className="p-3">Created</th><th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p._id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-mono font-bold text-accent-glow">{p.code}</td>
                <td className="p-3 text-right tabular-nums text-win">{inr(p.amount)}</td>
                <td className="p-3 text-right tabular-nums">{p.uses}{p.maxUses ? ` / ${p.maxUses}` : ''}</td>
                <td className="p-3 text-center">{p.active ? <span className="text-win">● active</span> : <span className="text-white/30">○ off</span>}</td>
                <td className="p-3 text-white/50">{dt(p.createdAt)}</td>
                <td className="p-3 text-center"><button onClick={() => toggle(p)} className="rounded bg-base-600 px-2 py-1 text-xs hover:bg-base-700">{p.active ? 'Disable' : 'Enable'}</button></td>
              </tr>
            ))}
            {promos.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-white/40">No promo codes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

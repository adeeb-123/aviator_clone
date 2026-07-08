'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { inr, dt } from '@/lib/format';
import type { CryptoTx, CryptoCoin } from '@/types';

export default function Crypto() {
  const [pending, setPending] = useState<CryptoTx[]>([]);
  const [coins, setCoins] = useState<CryptoCoin[]>([]);
  const [cryptoEnabled, setCryptoEnabled] = useState(true);
  const [limits, setLimits] = useState({ min: 500, max: 500000, confirmSeconds: 10 });
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get('/admin/crypto/withdrawals', { params: { status: 'pending' } }).then((r) => setPending(r.data.withdrawals)).catch(() => {});
    api.get('/admin/config').then((r) => {
      const c = r.data.config;
      setCoins(c.cryptoCoins ?? []); setCryptoEnabled(c.cryptoEnabled ?? true);
      setLimits({ min: c.cryptoWithdrawMin ?? 500, max: c.cryptoWithdrawMax ?? 500000, confirmSeconds: c.cryptoConfirmSeconds ?? 10 });
    }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => { await api.post(`/admin/crypto/withdrawals/${id}/approve`).catch(() => {}); setMsg('✓ Withdrawal approved & marked paid'); load(); };
  const reject = async (id: string) => { const reason = prompt('Reason for rejection (funds are refunded):') ?? ''; await api.post(`/admin/crypto/withdrawals/${id}/reject`, { reason }).catch(() => {}); setMsg('↩ Withdrawal rejected & refunded'); load(); };
  const setCoin = (symbol: string, patch: Partial<CryptoCoin>) => setCoins((cs) => cs.map((c) => (c.symbol === symbol ? { ...c, ...patch } : c)));
  const saveCoins = async () => {
    try { await api.patch('/admin/config', { cryptoEnabled, cryptoCoins: coins, cryptoWithdrawMin: limits.min, cryptoWithdrawMax: limits.max, cryptoConfirmSeconds: limits.confirmSeconds }); setMsg('✓ Crypto settings saved'); }
    catch { setMsg('Could not save'); }
  };

  return (
    <div className="space-y-5">
      {msg && <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent-glow">{msg}</p>}

      {/* withdrawal approval queue */}
      <div className="glass overflow-x-auto p-0">
        <div className="p-4 pb-2 text-sm font-bold uppercase tracking-widest text-white/40">⬆ Pending crypto withdrawals ({pending.length})</div>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="p-3">Player</th><th className="p-3">Coin</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">₹ value</th>
              <th className="p-3">Destination</th><th className="p-3">Requested</th><th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((w) => (
              <tr key={w._id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-semibold">@{w.username}</td>
                <td className="p-3">{w.coin}</td>
                <td className="p-3 text-right tabular-nums">{w.cryptoAmount}</td>
                <td className="p-3 text-right tabular-nums text-loss">{inr(w.inrAmount)}</td>
                <td className="p-3"><code className="text-[11px] text-white/50">{w.address.slice(0, 14)}…{w.address.slice(-6)}</code></td>
                <td className="p-3 text-xs text-white/50">{dt(w.createdAt)}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => approve(w._id)} className="rounded bg-win/80 px-2 py-1 text-xs text-white hover:bg-win">Approve</button>
                    <button onClick={() => reject(w._id)} className="rounded bg-base-600 px-2 py-1 text-xs hover:bg-loss">Reject</button>
                  </div>
                </td>
              </tr>
            ))}
            {pending.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-white/40">No pending withdrawals.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* coin config */}
      <div className="glass space-y-3 p-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">🪙 Coins & rates</h3>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cryptoEnabled} onChange={(e) => setCryptoEnabled(e.target.checked)} /> Crypto wallet enabled</label>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1.5fr_1fr_auto] items-center gap-2 text-[11px] uppercase tracking-wider text-white/40"><span>Symbol</span><span>Base rate (₹)</span><span>Network fee</span><span>On</span></div>
          {coins.map((c) => (
            <div key={c.symbol} className="grid grid-cols-[1fr_1.5fr_1fr_auto] items-center gap-2">
              <span className="text-sm font-bold">{c.symbol} <span className="text-xs font-normal text-white/40">{c.name}</span></span>
              <input type="number" value={c.rate} onChange={(e) => setCoin(c.symbol, { rate: Number(e.target.value) })} className="input py-1" />
              <input type="number" step="any" value={c.networkFee ?? 0} onChange={(e) => setCoin(c.symbol, { networkFee: Number(e.target.value) })} className="input py-1" />
              <input type="checkbox" checked={c.enabled} onChange={(e) => setCoin(c.symbol, { enabled: e.target.checked })} />
            </div>
          ))}
        </div>
        <div className="grid gap-4 border-t border-white/10 pt-3 sm:grid-cols-3">
          <label className="block"><span className="mb-1 block text-xs text-white/50">Min withdrawal (₹)</span><input type="number" value={limits.min} onChange={(e) => setLimits((l) => ({ ...l, min: Number(e.target.value) }))} className="input" /></label>
          <label className="block"><span className="mb-1 block text-xs text-white/50">Max withdrawal (₹)</span><input type="number" value={limits.max} onChange={(e) => setLimits((l) => ({ ...l, max: Number(e.target.value) }))} className="input" /></label>
          <label className="block"><span className="mb-1 block text-xs text-white/50">Deposit confirm delay (sec)</span><input type="number" value={limits.confirmSeconds} onChange={(e) => setLimits((l) => ({ ...l, confirmSeconds: Number(e.target.value) }))} className="input" /></label>
        </div>
        <button onClick={saveCoins} className="btn-primary">Save crypto settings</button>
      </div>
    </div>
  );
}

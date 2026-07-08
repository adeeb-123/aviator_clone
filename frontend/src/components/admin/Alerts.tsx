'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAlerts } from '@/lib/store';
import { dt, inr } from '@/lib/format';
import type { AdminAlert } from '@/types';
import PlayerDetail from './PlayerDetail';

const META: Record<string, { icon: string; label: string }> = {
  'large-bet': { icon: '💰', label: 'Large bet' },
  'big-win': { icon: '🎯', label: 'Big win' },
  'big-payout': { icon: '💸', label: 'Big payout' },
  'high-balance': { icon: '🏦', label: 'High balance' },
  'large-withdrawal': { icon: '⚠️', label: 'Large withdrawal' },
  'large-deposit': { icon: '⬆️', label: 'Large deposit' },
};

const sevColor = (s: string) => (s === 'critical' ? 'border-loss/50 bg-loss/5' : s === 'warning' ? 'border-gold/40 bg-gold/5' : 'border-accent/40 bg-accent/5');
const sevDot = (s: string) => (s === 'critical' ? 'bg-loss' : s === 'warning' ? 'bg-gold' : 'bg-accent-glow');

const THRESHOLD_LABELS: Record<string, string> = {
  largeBet: 'Large bet ≥ ₹',
  bigWinMultiplier: 'Big win ≥ (×)',
  highBalance: 'High balance ≥ ₹',
  largeWithdrawal: 'Large withdrawal ≥ ₹',
  largeDeposit: 'Large deposit ≥ ₹',
  bigPayout: 'Big payout ≥ ₹',
};

export default function Alerts() {
  const { alerts, unread, setAll, markRead, markAll } = useAlerts();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Record<string, number> | null>(null);
  const [cfgMsg, setCfgMsg] = useState('');

  const load = () => api.get('/admin/alerts', { params: { limit: 100 } }).then((r) => setAll(r.data.alerts, r.data.unread)).catch(() => {});
  useEffect(() => {
    load();
    api.get('/admin/alerts/config').then((r) => setCfg(r.data.thresholds)).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const onRead = async (a: AdminAlert) => {
    const id = a._id ?? a.id ?? '';
    if (!a.read) { markRead(id); await api.post(`/admin/alerts/${id}/read`).catch(() => {}); }
  };
  const onReadAll = async () => { markAll(); await api.post('/admin/alerts/read-all').catch(() => {}); };

  const saveCfg = async () => {
    if (!cfg) return;
    setCfgMsg('');
    try { const r = await api.patch('/admin/alerts/config', cfg); setCfg(r.data.thresholds); setCfgMsg('Saved ✓'); } catch { setCfgMsg('Save failed'); }
  };

  const shown = unreadOnly ? alerts.filter((a) => !a.read) : alerts;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      {/* feed */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">
            Alerts {unread > 0 && <span className="ml-2 rounded-full bg-loss px-2 py-0.5 text-xs font-bold text-white">{unread} new</span>}
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />unread only</label>
            <button onClick={load} className="rounded bg-base-600 px-2.5 py-1 font-semibold text-white/80 hover:bg-base-700">↻ Refresh</button>
            <button onClick={onReadAll} className="rounded bg-base-600 px-2.5 py-1 font-semibold text-white/80 hover:bg-base-700">Mark all read</button>
          </div>
        </div>

        <div className="space-y-2">
          {shown.length === 0 && <p className="glass p-6 text-center text-sm text-white/30">No alerts. New high-value events will appear here in real time. 🔔</p>}
          {shown.map((a) => {
            const m = META[a.type] ?? { icon: '🔔', label: a.type };
            return (
              <div key={a._id ?? a.id} className={`glass flex items-start gap-3 border p-3 ${sevColor(a.severity)} ${a.read ? 'opacity-60' : ''}`}>
                <div className="text-xl">{m.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${sevDot(a.severity)}`} />
                    <span className="text-xs font-bold uppercase tracking-wide text-white/60">{m.label}</span>
                    <span className="text-[11px] text-white/30">{dt(a.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/90">{a.message}</p>
                  {a.meta?.email != null && (
                    <p className="mt-0.5 text-[11px] text-white/40">{String(a.meta.email)}{a.meta.balance != null ? ` · balance ${inr(Number(a.meta.balance))}` : ''}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {a.userId && <button onClick={() => setSelected(a.userId!)} className="text-xs text-accent-glow hover:underline">view player</button>}
                  {!a.read && <button onClick={() => onRead(a)} className="text-xs text-white/40 hover:text-white">mark read</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* thresholds */}
      <div className="glass h-fit p-4">
        <h3 className="mb-1 font-semibold">Alert thresholds</h3>
        <p className="mb-3 text-xs text-white/40">Tune when alerts fire. Applies immediately.</p>
        {!cfg ? (
          <p className="text-sm text-white/30">Loading…</p>
        ) : (
          <div className="space-y-2">
            {Object.keys(cfg).map((k) => (
              <label key={k} className="block">
                <span className="text-xs text-white/50">{THRESHOLD_LABELS[k] ?? k}</span>
                <input
                  type="number"
                  className="input mt-1"
                  value={cfg[k]}
                  onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
            <button onClick={saveCfg} className="btn-primary mt-2 w-full text-sm">Save thresholds</button>
            {cfgMsg && <p className="text-center text-xs text-gold">{cfgMsg}</p>}
          </div>
        )}
      </div>

      {selected && <PlayerDetail userId={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

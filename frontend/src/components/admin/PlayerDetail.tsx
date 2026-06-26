'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { inr, num, pct, dt } from '@/lib/format';

interface Props {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}

export default function PlayerDetail({ userId, onClose, onChanged }: Props) {
  const [data, setData] = useState<any>(null);
  const [grant, setGrant] = useState('100');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = () => api.get(`/admin/analytics/players/${userId}`).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await load(); onChanged(); } finally { setBusy(false); } };

  if (!mounted) return null;
  const u = data?.user;
  const s = data?.stats;

  const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div className="rounded-lg bg-base-700/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`text-lg font-bold ${tone ?? 'text-white'}`}>{value}</div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={onClose}>
      <div className="glass my-8 w-full max-w-3xl p-6" onClick={(e) => e.stopPropagation()}>
        {!data ? (
          <p className="text-white/50">Loading…</p>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black">{u.username} {u.role === 'admin' && <span className="text-xs text-gold">ADMIN</span>}</h2>
                <p className="text-sm text-white/40">{u.email}</p>
                <p className="mt-1 text-xs text-white/30">Joined {dt(u.createdAt)} · Last active {dt(u.lastActiveAt)} · VIP {u.vipTier ?? 0}</p>
              </div>
              <button onClick={onClose} className="rounded px-2 text-2xl text-white/40 hover:text-white">×</button>
            </div>

            {/* economics */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Balance" value={inr(u.balance)} tone="text-gold" />
              <Stat label="Wagered" value={inr(s.wagered)} tone="text-accent-glow" />
              <Stat label="Won" value={inr(s.won)} />
              <Stat label="House P/L" value={inr(s.housePL)} tone={s.housePL >= 0 ? 'text-win' : 'text-loss'} />
              <Stat label="Player P/L" value={inr(s.playerPL)} tone={s.playerPL >= 0 ? 'text-win' : 'text-loss'} />
              <Stat label="Bets / Wins" value={`${num(s.bets)} / ${num(s.wins)}`} />
              <Stat label="Win rate" value={pct(s.winRate)} />
              <Stat label="Best multiplier" value={`${s.bestMultiplier}x`} tone="text-gold" />
              <Stat label="Avg bet" value={inr(s.avgBet)} />
              <Stat label="Biggest bet" value={inr(s.biggestBet)} />
              <Stat label="Deposits" value={inr(s.deposits)} tone="text-win" />
              <Stat label="Withdrawals" value={inr(s.withdrawals)} tone="text-loss" />
            </div>

            {/* actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input value={grant} onChange={(e) => setGrant(e.target.value)} className="input max-w-[100px]" />
              <button disabled={busy} className="btn-win text-sm" onClick={() => act(() => api.post('/admin/balance', { userId, amount: Number(grant), reason: 'Admin grant' }))}>Credit ₹</button>
              <button disabled={busy} className="btn bg-base-600 text-sm text-white" onClick={() => act(() => api.post('/admin/balance', { userId, amount: -Number(grant), reason: 'Admin debit' }))}>Debit ₹</button>
              <button disabled={busy} className={`btn text-sm ${u.isBanned ? 'btn-win' : 'btn-loss'}`} onClick={() => act(() => api.patch(`/admin/users/${userId}`, { isBanned: !u.isBanned }))}>
                {u.isBanned ? 'Unban' : 'Ban'}
              </button>
              <button disabled={busy} className="btn bg-base-600 text-sm text-white" onClick={() => act(() => api.post(`/admin/users/${userId}/mute`, { minutes: 60 }))}>🔇 Mute 1h</button>
              <button disabled={busy} className="btn bg-base-600 text-sm text-white" onClick={() => act(() => api.post(`/admin/users/${userId}/mute`, { minutes: 0 }))}>🔊 Unmute</button>
              {u.isBanned && <span className="text-xs text-loss">● banned</span>}
              {u.chatMutedUntil && new Date(u.chatMutedUntil) > new Date() && <span className="text-xs text-gold">● muted</span>}
            </div>

            {/* recent bets + transactions */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-white/70">Recent bets</h4>
                <div className="max-h-56 space-y-1 overflow-y-auto text-xs">
                  {data.recentBets.length === 0 && <p className="text-white/30">No bets.</p>}
                  {data.recentBets.map((b: any) => (
                    <div key={b._id} className="flex items-center justify-between rounded bg-base-700/40 px-2 py-1.5">
                      <span className="text-white/50">#{b.roundId}</span>
                      <span>{inr(b.amount)}</span>
                      <span className={b.status === 'cashed-out' ? 'text-win' : 'text-loss'}>{b.cashoutMultiplier ? `${b.cashoutMultiplier}x` : 'lost'}</span>
                      <span className={b.payout > 0 ? 'text-win' : 'text-white/30'}>{b.payout > 0 ? '+' + inr(b.payout) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-white/70">Recent transactions</h4>
                <div className="max-h-56 space-y-1 overflow-y-auto text-xs">
                  {data.recentTransactions.map((t: any) => (
                    <div key={t._id} className="flex items-center justify-between rounded bg-base-700/40 px-2 py-1.5">
                      <span className="capitalize text-white/50">{t.type}</span>
                      <span className={t.amount >= 0 ? 'text-win' : 'text-loss'}>{t.amount >= 0 ? '+' : ''}{inr(t.amount)}</span>
                      <span className="text-white/30">{inr(t.balanceAfter)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

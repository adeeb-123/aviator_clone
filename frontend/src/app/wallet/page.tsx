'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import CryptoWallet from '@/components/CryptoWallet';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { inr, inrCompact, dt } from '@/lib/format';

interface Tx {
  _id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

const TX_META: Record<string, { icon: string; label: string; tone: string }> = {
  deposit: { icon: '⬇️', label: 'Deposit', tone: 'text-win' },
  withdraw: { icon: '⬆️', label: 'Withdrawal', tone: 'text-loss' },
  bet: { icon: '🎲', label: 'Bet', tone: 'text-loss' },
  win: { icon: '🏆', label: 'Win', tone: 'text-win' },
  bonus: { icon: '🎁', label: 'Bonus', tone: 'text-gold' },
  refund: { icon: '↩️', label: 'Refund', tone: 'text-win' },
  'admin-adjust': { icon: '🛠️', label: 'Adjustment', tone: 'text-accent-glow' },
};
const meta = (t: string) => TX_META[t] ?? { icon: '•', label: t, tone: 'text-white/70' };

const FILTERS: { id: string; label: string; types: string[] }[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'money', label: 'Deposits & Withdrawals', types: ['deposit', 'withdraw', 'refund'] },
  { id: 'play', label: 'Gameplay', types: ['bet', 'win'] },
  { id: 'bonus', label: 'Bonuses', types: ['bonus'] },
];
const QUICK = [100, 500, 1000, 5000];

export default function WalletPage() {
  const user = useAuth((s) => s.user);
  const setBalance = useAuth((s) => s.setBalance);
  const [depAmt, setDepAmt] = useState(500);
  const [wdAmt, setWdAmt] = useState(500);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [filter, setFilter] = useState('all');

  const loadTx = () => api.get('/users/transactions').then(({ data }) => setTxs(data.transactions)).catch(() => {});

  useEffect(() => {
    loadTx();
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('status') === 'success' && sessionId) {
      api.post('/payments/confirm', { sessionId })
        .then(({ data }) => {
          if (data.balance !== undefined) setBalance(data.balance);
          setMsg({ text: data.credited ? `Deposit successful — ${inr(data.amount)} added.` : data.already ? 'Deposit already credited.' : 'Payment not completed.', ok: true });
          loadTx();
        })
        .catch(() => setMsg({ text: 'Could not confirm the deposit.' }))
        .finally(() => window.history.replaceState({}, '', '/wallet'));
    } else if (params.get('status') === 'cancel') {
      setMsg({ text: 'Deposit cancelled.' });
      window.history.replaceState({}, '', '/wallet');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deposit = async () => {
    setMsg(null);
    try {
      const { data } = await api.post('/payments/checkout', { amount: depAmt });
      if (data.url) window.location.href = data.url;
    } catch (e: unknown) {
      setMsg({ text: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not start the deposit.' });
    }
  };
  const withdraw = async () => {
    setMsg(null);
    try {
      const { data } = await api.post('/payments/withdraw', { amount: wdAmt });
      if (data.balance !== undefined) setBalance(data.balance);
      setMsg({ text: `Withdrew ${inr(wdAmt)} — new balance ${inr(data.balance ?? 0)}.`, ok: true });
      loadTx();
    } catch (e: unknown) {
      setMsg({ text: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Withdraw failed' });
    }
  };

  const totals = useMemo(() => {
    let dep = 0, wd = 0, bonus = 0;
    for (const t of txs) {
      if (t.type === 'deposit') dep += t.amount;
      else if (t.type === 'withdraw') wd += Math.abs(t.amount);
      else if (t.type === 'bonus') bonus += t.amount;
    }
    return { dep, wd, bonus };
  }, [txs]);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    return !f || f.types.length === 0 ? txs : txs.filter((t) => f.types.includes(t.type));
  }, [txs, filter]);

  const copyRef = () => { if (user?.referralCode) navigator.clipboard?.writeText(user.referralCode); };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl space-y-5 px-3 py-8 sm:px-4">
        <h1 className="text-2xl font-black sm:text-3xl">Wallet</h1>

        {/* balance hero */}
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-accent/20 via-base-800 to-base-900 p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/50">Available balance</div>
              <div className="mt-1 text-4xl font-black tabular-nums text-win sm:text-5xl">₹{(user?.balance ?? 0).toFixed(2)}</div>
            </div>
            {user && (
              <button onClick={copyRef} className="rounded-lg border border-white/10 bg-base-900/50 px-3 py-2 text-left text-xs transition hover:border-accent/50">
                <div className="text-white/40">Referral code · tap to copy</div>
                <div className="font-mono text-sm text-accent-glow">{user.referralCode}</div>
              </button>
            )}
          </div>
          <div className="relative mt-5 grid grid-cols-3 gap-3">
            <Mini label="Deposited" value={inrCompact(totals.dep)} tone="text-win" />
            <Mini label="Withdrawn" value={inrCompact(totals.wd)} tone="text-loss" />
            <Mini label="Bonuses" value={inrCompact(totals.bonus)} tone="text-gold" />
          </div>
        </section>

        {msg && <p className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}>{msg.ok ? '✓ ' : '⚠ '}{msg.text}</p>}

        {/* add funds / withdraw */}
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="glass p-5">
            <h2 className="flex items-center gap-2 font-semibold">💳 Add funds <span className="text-xs font-normal text-white/40">via card</span></h2>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {QUICK.map((q) => (
                <button key={q} onClick={() => setDepAmt(q)} className={`rounded-lg py-1.5 text-xs font-semibold ${depAmt === q ? 'bg-accent text-white' : 'bg-base-700 text-white/70 hover:text-white'}`}>₹{q}</button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-white/40">₹</span>
              <input type="number" min={1} value={depAmt} onChange={(e) => setDepAmt(Number(e.target.value))} className="input" />
            </div>
            <button onClick={deposit} className="btn-win mt-3 w-full">Deposit {inr(depAmt)}</button>
            <p className="mt-2 text-[11px] text-white/30">Secure card payment via Stripe (test mode).</p>
          </section>

          <section className="glass p-5">
            <h2 className="flex items-center gap-2 font-semibold">🏧 Withdraw <span className="text-xs font-normal text-white/40">to card</span></h2>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-white/40">₹</span>
              <input type="number" min={1} value={wdAmt} onChange={(e) => setWdAmt(Number(e.target.value))} className="input" />
              <button onClick={() => setWdAmt(Math.floor(user?.balance ?? 0))} className="btn shrink-0 bg-base-700 text-xs text-white/70">Max</button>
            </div>
            <button onClick={withdraw} disabled={wdAmt <= 0 || wdAmt > (user?.balance ?? 0)} className="btn-primary mt-3 w-full disabled:opacity-40">Withdraw {inr(wdAmt)}</button>
            <p className="mt-2 text-[11px] text-white/30">Prefer crypto? Use the crypto wallet below.</p>
          </section>
        </div>

        <CryptoWallet />

        {/* transactions */}
        <section className="glass p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Transaction history</h2>
            <div className="flex flex-wrap gap-1 text-xs">
              {FILTERS.map((f) => (
                <button key={f.id} onClick={() => setFilter(f.id)} className={`rounded-lg px-2.5 py-1 font-semibold ${filter === f.id ? 'bg-accent text-white' : 'bg-base-700/60 text-white/50 hover:text-white'}`}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            {shown.length === 0 && <p className="py-6 text-center text-sm text-white/30">No transactions here yet.</p>}
            {shown.map((t) => {
              const m = meta(t.type);
              return (
                <div key={t._id} className="flex items-center gap-3 rounded-lg bg-base-700/30 px-3 py-2 transition hover:bg-base-700/50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-base-900/60 text-base">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{m.label}</div>
                    <div className="truncate text-[11px] text-white/40">{t.description || dt(t.createdAt)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-bold tabular-nums ${t.amount >= 0 ? 'text-win' : 'text-loss'}`}>{t.amount >= 0 ? '+' : '−'}{inr(Math.abs(t.amount))}</div>
                    <div className="text-[11px] tabular-nums text-white/30">bal {inr(t.balanceAfter)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-base-900/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-black tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

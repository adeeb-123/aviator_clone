'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';

interface Tx {
  _id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export default function WalletPage() {
  const user = useAuth((s) => s.user);
  const setBalance = useAuth((s) => s.setBalance);
  const [amount, setAmount] = useState(50);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [msg, setMsg] = useState('');

  const loadTx = () => api.get('/users/transactions').then(({ data }) => setTxs(data.transactions)).catch(() => {});

  useEffect(() => {
    loadTx();
    // After returning from Stripe Checkout, confirm + credit the deposit (works on
    // localhost, where the webhook can't reach us). Idempotent on the session id.
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('status') === 'success' && sessionId) {
      api.post('/payments/confirm', { sessionId })
        .then(({ data }) => {
          if (data.balance !== undefined) setBalance(data.balance);
          setMsg(data.credited ? `✓ Deposit successful — ₹${data.amount} added.` : data.already ? '✓ Deposit already credited.' : 'Payment not completed.');
          loadTx();
        })
        .catch(() => setMsg('Could not confirm the deposit.'))
        .finally(() => window.history.replaceState({}, '', '/wallet'));
    } else if (params.get('status') === 'cancel') {
      setMsg('Deposit cancelled.');
      window.history.replaceState({}, '', '/wallet');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deposit = async () => {
    setMsg('');
    try {
      const { data } = await api.post('/payments/checkout', { amount });
      if (data.url) window.location.href = data.url;
    } catch (e: unknown) {
      // Surface the real backend reason (e.g. "Minimum deposit is ₹50") instead of a generic message.
      setMsg((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not start the deposit. Please try again.');
    }
  };

  const withdraw = async () => {
    setMsg('');
    try {
      const { data } = await api.post('/payments/withdraw', { amount });
      if (data.balance !== undefined) setBalance(data.balance);
      setMsg(`✓ Withdrew ₹${amount.toFixed(2)} — new balance ₹${(data.balance ?? 0).toFixed(2)}.`);
      loadTx();
    } catch (e: unknown) {
      setMsg((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Withdraw failed');
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-3xl font-black">Wallet</h1>
        <div className="glass p-6">
          <div className="text-sm text-white/50">Current balance</div>
          <div className="text-4xl font-black text-win">₹{user?.balance.toFixed(2) ?? '0.00'}</div>

          <div className="mt-4 flex items-center gap-2">
            <input
              type="number"
              min={1}
              className="input max-w-[160px]"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <button className="btn-win" onClick={deposit}>
              Deposit (Stripe)
            </button>
            <button className="btn bg-base-600 text-white" onClick={withdraw}>
              Withdraw
            </button>
          </div>
          {msg && <p className="mt-2 text-sm text-gold">{msg}</p>}
          {user && (
            <p className="mt-3 text-xs text-white/40">
              Your referral code: <span className="font-mono text-accent-glow">{user.referralCode}</span>
            </p>
          )}
        </div>

        <div className="glass p-6">
          <h2 className="mb-3 font-semibold">Transactions</h2>
          <div className="space-y-1 text-sm">
            {txs.map((t) => (
              <div key={t._id} className="flex items-center justify-between rounded bg-base-700/40 px-3 py-1.5">
                <span className="capitalize text-white/60">{t.type}</span>
                <span className="flex-1 truncate px-3 text-white/40">{t.description}</span>
                <span className={t.amount >= 0 ? 'text-win' : 'text-loss'}>
                  {t.amount >= 0 ? '+₹' : '-₹'}
                  {Math.abs(t.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

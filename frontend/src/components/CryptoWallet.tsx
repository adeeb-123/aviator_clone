'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { inr, dt } from '@/lib/format';
import { sound } from '@/lib/sound';
import type { CryptoCoin, CryptoTx } from '@/types';

const errText = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Something went wrong';
const ICON: Record<string, string> = { BTC: '₿', ETH: 'Ξ', USDT: '₮', LTC: 'Ł' };
const STATUS: Record<string, string> = { confirmed: 'text-win', completed: 'text-win', pending: 'text-gold', rejected: 'text-loss' };

export default function CryptoWallet() {
  const setBalance = useAuth((s) => s.setBalance);
  const [coins, setCoins] = useState<CryptoCoin[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [sel, setSel] = useState('');
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [txs, setTxs] = useState<CryptoTx[]>([]);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get('/crypto/coins').then((r) => { setCoins(r.data.coins); setEnabled(r.data.enabled); setSel((s) => s || r.data.coins[0]?.symbol || ''); }).catch(() => {});
    api.get('/crypto/history').then((r) => setTxs(r.data.transactions)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const coin = coins.find((c) => c.symbol === sel);
  const inrValue = coin && Number(amount) ? Number(amount) * coin.rate : 0;

  const deposit = async () => {
    if (!coin || !Number(amount)) return;
    setBusy(true); setMsg('');
    try { const { data } = await api.post('/crypto/deposit', { coin: sel, cryptoAmount: Number(amount) }); setBalance(data.balance); sound.reward(); setMsg(`✅ Deposited ${amount} ${sel} → +${inr(data.tx.inrAmount)}`); setAmount(''); load(); }
    catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };
  const withdraw = async () => {
    if (!coin || !Number(amount) || !address) return;
    setBusy(true); setMsg('');
    try { const { data } = await api.post('/crypto/withdraw', { coin: sel, cryptoAmount: Number(amount), address }); setBalance(data.balance); setMsg(`⏳ Withdrawal of ${amount} ${sel} requested — pending admin approval.`); setAmount(''); setAddress(''); load(); }
    catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };
  const copy = () => { if (coin?.address) { navigator.clipboard?.writeText(coin.address); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  if (!enabled) return null;

  return (
    <div className="glass p-6">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">🪙 Crypto Wallet <span className="rounded bg-base-700 px-1.5 py-0.5 text-[10px] font-normal text-white/40">DEMO</span></h2>
      <p className="mb-4 text-xs text-white/40">Deposit or withdraw using crypto. Balances convert to ₹ at the live rate.</p>

      {/* coin selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {coins.map((c) => (
          <button key={c.symbol} onClick={() => setSel(c.symbol)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${sel === c.symbol ? 'border-accent-glow bg-accent/15 text-white' : 'border-white/10 text-white/60 hover:text-white'}`}>
            <span className="text-base">{ICON[c.symbol] ?? '🪙'}</span> {c.symbol}
            <span className="text-[11px] text-white/40">₹{c.rate.toLocaleString('en-IN')}</span>
          </button>
        ))}
      </div>

      {/* deposit / withdraw tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-base-700/60 p-0.5 text-sm">
        {(['deposit', 'withdraw'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setMsg(''); }} className={`flex-1 rounded px-3 py-1.5 font-semibold capitalize ${tab === t ? 'bg-accent text-white' : 'text-white/50'}`}>{t}</button>
        ))}
      </div>

      {coin && tab === 'deposit' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-base-900/50 p-3">
            <div className="mb-1 text-[11px] uppercase tracking-widest text-white/40">Your {coin.name} deposit address</div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-base-800 px-2 py-1.5 font-mono text-xs text-accent-glow">{coin.address}</code>
              <button onClick={copy} className="btn-primary shrink-0 px-3 py-1.5 text-xs">{copied ? '✓' : 'Copy'}</button>
            </div>
            {/* faux scan panel */}
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 grid-cols-4 gap-0.5 rounded bg-white p-1.5" aria-hidden>
                {Array.from({ length: 16 }).map((_, i) => <div key={i} className={((i * 7 + (coin.address?.charCodeAt(i % (coin.address.length || 1)) ?? 0)) % 2) ? 'bg-black' : 'bg-white'} />)}
              </div>
              <p className="text-xs text-white/40">Scan or copy the address, send {coin.symbol}, then enter the amount you sent below.</p>
            </div>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-white/50">Amount ({coin.symbol})</span>
            <input type="number" step="any" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`0.00 ${coin.symbol}`} className="input" />
          </label>
          {inrValue > 0 && <p className="text-xs text-white/50">You&apos;ll receive <b className="text-win">{inr(inrValue)}</b></p>}
          <button onClick={deposit} disabled={busy || !Number(amount)} className="btn-win w-full">I&apos;ve sent it — credit my balance</button>
          <p className="text-[11px] text-white/30">Demo wallet: deposits confirm instantly. No real coins are moved.</p>
        </div>
      )}

      {coin && tab === 'withdraw' && (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-white/50">Destination {coin.name} address</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={`Paste your ${coin.symbol} wallet address`} className="input font-mono text-xs" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-white/50">Amount ({coin.symbol})</span>
            <input type="number" step="any" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`0.00 ${coin.symbol}`} className="input" />
          </label>
          {inrValue > 0 && <p className="text-xs text-white/50">Debits <b className="text-loss">{inr(inrValue)}</b> from your balance</p>}
          <button onClick={withdraw} disabled={busy || !Number(amount) || !address} className="btn-primary w-full">Request withdrawal</button>
          <p className="text-[11px] text-white/30">Withdrawals are debited immediately and paid out after admin approval (refunded if rejected).</p>
        </div>
      )}

      {msg && <p className="mt-3 rounded-lg bg-base-700/40 px-3 py-2 text-sm text-white/80">{msg}</p>}

      {/* history */}
      {txs.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">Crypto activity</h3>
          <div className="space-y-1 text-sm">
            {txs.map((t) => (
              <div key={t._id} className="flex items-center justify-between gap-2 rounded bg-base-700/40 px-3 py-1.5">
                <span className="capitalize text-white/60">{t.type === 'deposit' ? '⬇ Deposit' : '⬆ Withdraw'}</span>
                <span className="text-white/40">{t.cryptoAmount} {t.coin}</span>
                <span className={t.type === 'deposit' ? 'text-win' : 'text-loss'}>{t.type === 'deposit' ? '+' : '−'}{inr(t.inrAmount)}</span>
                <span className={`w-16 text-right text-xs capitalize ${STATUS[t.status] ?? 'text-white/40'}`}>{t.status}</span>
                <span className="hidden w-24 text-right text-[11px] text-white/30 sm:block">{dt(t.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

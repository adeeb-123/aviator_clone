'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getSocket, EVENTS } from '@/lib/socket';
import { useAuth, useGame } from '@/lib/store';
import { sound } from '@/lib/sound';
import { api } from '@/lib/api';
import type { FavoriteStrategy } from '@/types';

interface Props {
  slot: 1 | 2;
}

const QUICK = [10, 50, 100, 500];

export default function BetPanel({ slot }: Props) {
  const user = useAuth((s) => s.user);
  const setBalance = useAuth((s) => s.setBalance);
  const phase = useGame((s) => s.phase);
  const multiplier = useGame((s) => s.multiplier);

  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [amount, setAmount] = useState(10);
  const [autoCashout, setAutoCashout] = useState('2.00');
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  // ── auto-bet config + running state ──
  const [autoRunning, setAutoRunning] = useState(false);
  const [rounds, setRounds] = useState('');
  const [onLoss, setOnLoss] = useState<'reset' | 'x2'>('reset');
  const [stopProfit, setStopProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [sessionPL, setSessionPL] = useState(0);

  // refs so socket callbacks read current values
  const r = useRef({ running: false, placed: false, stake: 0, won: false, payout: 0, pl: 0, cur: 10, base: 10, roundsLeft: -1, stopP: 0, stopL: 0, target: 2 });

  // ── saved strategies (favorites) ──
  const [favorites, setFavorites] = useState<FavoriteStrategy[]>([]);
  useEffect(() => { if (user) api.get('/users/favorites').then((res) => setFavorites(res.data.favorites)).catch(() => {}); }, [user]);
  const applyFav = (name: string) => {
    const f = favorites.find((x) => x.name === name);
    if (!f) return;
    setAmount(f.amount);
    if (f.autoCashout) setAutoCashout(String(f.autoCashout));
  };
  const saveFav = async () => {
    const name = typeof window !== 'undefined' ? window.prompt('Name this strategy:') : '';
    if (!name) return;
    try {
      const { data } = await api.post('/users/favorites', { name: name.slice(0, 40), amount, autoCashout: Number(autoCashout) || undefined });
      setFavorites(data.favorites); setMsg('✓ Strategy saved');
    } catch { setMsg('Could not save strategy'); }
  };

  // reset per-round manual flags
  useEffect(() => {
    if (phase === 'betting') { setPlaced(false); setCashedAt(null); setMsg(''); }
  }, [phase]);

  // ── outcome tracking for auto-bet (own cashout + crash) ──
  useEffect(() => {
    const s = getSocket();
    const onCash = (c: { username: string; slot: number; payout: number }) => {
      if (r.current.running && c.username === user?.username && c.slot === slot) { r.current.won = true; r.current.payout = c.payout; }
    };
    const onCrash = () => {
      if (!r.current.running || r.current.stake <= 0) return;
      const won = r.current.won;
      const pl = won ? r.current.payout - r.current.stake : -r.current.stake;
      r.current.pl += pl;
      setSessionPL(r.current.pl);
      // next stake
      r.current.cur = won ? r.current.base : onLoss === 'x2' ? +(r.current.cur * 2).toFixed(2) : r.current.base;
      setAmount(r.current.cur);
      if (r.current.roundsLeft > 0) r.current.roundsLeft -= 1;
      const stop = r.current.roundsLeft === 0 || (r.current.stopP > 0 && r.current.pl >= r.current.stopP) || (r.current.stopL > 0 && r.current.pl <= -r.current.stopL);
      r.current.stake = 0; r.current.won = false; r.current.payout = 0; r.current.placed = false;
      if (stop) stopAuto();
    };
    s.on(EVENTS.BET_CASHOUT, onCash);
    s.on(EVENTS.ROUND_CRASHED, onCrash);
    return () => { s.off(EVENTS.BET_CASHOUT, onCash); s.off(EVENTS.ROUND_CRASHED, onCrash); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username, slot, onLoss]);

  // ── auto-bet placement loop ──
  useEffect(() => {
    if (mode !== 'auto' || !autoRunning) return;
    if (phase === 'betting' && !r.current.placed) placeAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoRunning, mode]);

  const placeAuto = () => {
    const bet = r.current.cur;
    getSocket().emit(EVENTS.PLACE_BET, { slot, amount: bet, autoCashout: r.current.target }, (res: { ok: boolean; balance?: number; error?: string }) => {
      if (res.ok) { r.current.stake = bet; r.current.placed = true; if (res.balance !== undefined) setBalance(res.balance); sound.bet(); setMsg(''); }
      else { setMsg(res.error ?? 'Auto-bet stopped'); stopAuto(); }
    });
  };

  const startAuto = () => {
    if (!user) { setMsg('Please log in'); return; }
    const target = Number(autoCashout);
    if (!(target >= 1.01)) { setMsg('Set an auto-cashout ≥ 1.01'); return; }
    r.current = { running: true, placed: false, stake: 0, won: false, payout: 0, pl: 0, cur: amount, base: amount, roundsLeft: rounds ? Math.max(1, Math.floor(Number(rounds))) : -1, stopP: Number(stopProfit) || 0, stopL: Number(stopLoss) || 0, target };
    setSessionPL(0);
    setAutoRunning(true);
  };
  const stopAuto = () => { r.current.running = false; setAutoRunning(false); };

  // ── manual actions ──
  const place = () => {
    if (!user) { setMsg('Please log in to bet'); return; }
    getSocket().emit(EVENTS.PLACE_BET, { slot, amount, autoCashout: autoEnabled && autoCashout ? Number(autoCashout) : undefined }, (res: { ok: boolean; balance?: number; error?: string }) => {
      if (res.ok) { setPlaced(true); if (res.balance !== undefined) setBalance(res.balance); setMsg(''); sound.bet(); }
      else setMsg(res.error ?? 'Bet failed');
    });
  };
  const cashout = () => {
    getSocket().emit(EVENTS.CASHOUT, { slot }, (res: { ok: boolean; payout?: number; multiplier?: number; balance?: number; error?: string }) => {
      if (res.ok) { setCashedAt(res.multiplier ?? null); if (res.balance !== undefined) setBalance(res.balance); setPlaced(false); sound.cashout(); }
      else setMsg(res.error ?? 'Cashout failed');
    });
  };

  const canBet = phase === 'betting' && !placed;
  const canCashout = phase === 'running' && placed && cashedAt === null;
  const potential = '₹' + (amount * multiplier).toFixed(2);
  const lock = autoRunning; // lock manual inputs while auto runs

  return (
    <div className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-base-700/60 p-0.5 text-xs">
          {(['manual', 'auto'] as const).map((m) => (
            <button key={m} disabled={autoRunning} onClick={() => setMode(m)} className={`rounded px-2.5 py-1 font-semibold capitalize ${mode === m ? 'bg-accent text-white' : 'text-white/50'}`}>{m}</button>
          ))}
        </div>
        <span className="text-[11px] uppercase tracking-widest text-white/30">Bet {slot}</span>
      </div>

      {/* amount */}
      <div className="flex items-center gap-2">
        <button disabled={lock} className="btn bg-base-600 text-white" onClick={() => setAmount((a) => Math.max(1, +(a / 2).toFixed(2)))}>½</button>
        <input type="number" min={1} disabled={lock} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} className="input text-center text-lg font-bold" />
        <button disabled={lock} className="btn bg-base-600 text-white" onClick={() => setAmount((a) => +(a * 2).toFixed(2))}>2×</button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {QUICK.map((q) => <button key={q} disabled={lock} className="btn bg-base-700 text-sm text-white/80" onClick={() => setAmount(q)}>{q}</button>)}
      </div>

      {/* auto-cashout (manual: optional toggle; auto: required) */}
      {mode === 'manual' ? (
        <label className="mt-2 flex items-center gap-2 text-xs text-white/60">
          <input type="checkbox" checked={autoEnabled} onChange={(e) => setAutoEnabled(e.target.checked)} /> Auto cashout
          {autoEnabled && <input type="number" step="0.1" min={1.01} value={autoCashout} onChange={(e) => setAutoCashout(e.target.value)} className="input ml-auto max-w-[90px] py-1 text-right" />}
        </label>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg bg-base-700/30 p-2.5 text-xs">
          <div className="flex items-center gap-2">
            <select disabled={lock} value="" onChange={(e) => applyFav(e.target.value)} className="input min-w-0 flex-1 py-1 text-xs">
              <option value="">⭐ Load strategy…</option>
              {favorites.map((f) => <option key={f.name} value={f.name}>{f.name} (₹{f.amount}{f.autoCashout ? ` @${f.autoCashout}x` : ''})</option>)}
            </select>
            <button disabled={lock} onClick={saveFav} className="btn bg-base-600 px-2 py-1 text-xs text-white/80">💾 Save</button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50">Cash out @</span>
            <input type="number" step="0.1" min={1.01} disabled={lock} value={autoCashout} onChange={(e) => setAutoCashout(e.target.value)} className="input max-w-[90px] py-1 text-right" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50">Rounds (∞ if empty)</span>
            <input type="number" min={1} placeholder="∞" disabled={lock} value={rounds} onChange={(e) => setRounds(e.target.value)} className="input max-w-[90px] py-1 text-right" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50">On loss</span>
            <div className="flex gap-1">
              {(['reset', 'x2'] as const).map((o) => <button key={o} disabled={lock} onClick={() => setOnLoss(o)} className={`rounded px-2 py-1 ${onLoss === o ? 'bg-accent text-white' : 'bg-base-600 text-white/60'}`}>{o === 'reset' ? 'Reset' : '×2'}</button>)}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50">Stop if profit ≥ ₹</span>
            <input type="number" min={0} placeholder="—" disabled={lock} value={stopProfit} onChange={(e) => setStopProfit(e.target.value)} className="input max-w-[90px] py-1 text-right" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50">Stop if loss ≥ ₹</span>
            <input type="number" min={0} placeholder="—" disabled={lock} value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className="input max-w-[90px] py-1 text-right" />
          </div>
          {autoRunning && (
            <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
              <span className="text-white/50">Session P/L</span>
              <span className={`font-bold ${sessionPL >= 0 ? 'text-win' : 'text-loss'}`}>{sessionPL >= 0 ? '+' : ''}₹{sessionPL.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* action */}
      <div className="mt-3">
        {mode === 'auto' ? (
          autoRunning ? (
            <button className="btn-loss w-full text-lg" onClick={stopAuto}>■ Stop auto-bet</button>
          ) : (
            <button className="btn-primary w-full text-lg" onClick={startAuto}>▶ Start auto-bet</button>
          )
        ) : canCashout ? (
          <motion.button className="btn-win w-full text-lg" onClick={cashout} animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}>Cash Out {potential}</motion.button>
        ) : cashedAt ? (
          <div className="btn-win w-full text-center text-lg">Cashed @ {cashedAt.toFixed(2)}x 🎉</div>
        ) : placed ? (
          <div className="btn w-full bg-base-600 text-center text-white/70">Waiting for round…</div>
        ) : (
          <button className="btn-primary w-full text-lg" onClick={place} disabled={!canBet}>Bet ₹{amount.toFixed(2)}</button>
        )}
      </div>

      {msg && <p className="mt-2 text-center text-sm text-loss">{msg}</p>}
    </div>
  );
}

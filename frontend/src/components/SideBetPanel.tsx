'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuth, useGame } from '@/lib/store';
import { sound } from '@/lib/sound';
import { inr } from '@/lib/format';

export default function SideBetPanel() {
  const user = useAuth((s) => s.user);
  const setBalance = useAuth((s) => s.setBalance);
  const enabled = useGame((s) => s.sideBetsEnabled);
  const markets = useGame((s) => s.sideBetMarkets);
  const phase = useGame((s) => s.phase);
  const roundId = useGame((s) => s.roundId);
  const [amount, setAmount] = useState(20);
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => { setPlaced({}); setMsg(''); }, [roundId]);

  useEffect(() => {
    const s = getSocket();
    const onResult = (r: { marketId: string; won: boolean; winAmount: number; crashPoint: number }) => {
      if (r.won) { sound.win(); setMsg(`✅ Crash ${r.crashPoint}x — side bet won ${inr(r.winAmount)}!`); }
      else setMsg(`❌ Crash ${r.crashPoint}x — side bet lost.`);
    };
    s.on('sidebet:result', onResult);
    return () => { s.off('sidebet:result', onResult); };
  }, []);

  if (!enabled || markets.length === 0) return null;

  const place = (marketId: string) => {
    if (!user) { setMsg('Log in to place a side bet'); return; }
    getSocket().emit('action:sideBet', { marketId, amount }, (res: { ok: boolean; balance?: number; error?: string }) => {
      if (res.ok) { setPlaced((p) => ({ ...p, [marketId]: amount })); if (res.balance !== undefined) setBalance(res.balance); sound.bet(); setMsg(''); }
      else setMsg(res.error ?? 'Side bet failed');
    });
  };
  const canBet = phase === 'betting';

  return (
    <div className="glass p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">🎯 Side Bets <span className="text-xs font-normal text-white/40">— will the crash beat the target?</span></h3>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setAmount((a) => Math.max(1, a - 10))} className="btn bg-base-600 px-2.5 py-1 text-white">−</button>
          <span className="min-w-[60px] text-center font-bold tabular-nums">₹{amount}</span>
          <button onClick={() => setAmount((a) => a + 10)} className="btn bg-base-600 px-2.5 py-1 text-white">+</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {markets.map((m) => {
          const done = placed[m.id];
          return (
            <button
              key={m.id}
              disabled={!canBet || !!done}
              onClick={() => place(m.id)}
              className={`rounded-xl border p-2 text-center transition disabled:cursor-not-allowed ${done ? 'border-gold/60 bg-gold/10' : canBet ? 'border-white/10 bg-base-700/40 hover:border-accent hover:bg-accent/10' : 'border-white/5 bg-base-700/20 opacity-50'}`}
            >
              <div className="text-sm font-black">≥ {m.threshold}x</div>
              <div className="text-[11px] font-bold text-win">{m.payout}x pay</div>
              {done ? <div className="mt-0.5 text-[10px] text-gold">bet ₹{done}</div> : null}
            </button>
          );
        })}
      </div>
      {!canBet && <p className="mt-2 text-xs text-white/30">Side bets open during the betting window.</p>}
      {msg && <p className="mt-2 text-sm text-white/80">{msg}</p>}
    </div>
  );
}

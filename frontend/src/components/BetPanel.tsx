'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getSocket, EVENTS } from '@/lib/socket';
import { useAuth, useGame } from '@/lib/store';

interface Props {
  slot: 1 | 2;
}

const QUICK = [1, 5, 10, 50];

export default function BetPanel({ slot }: Props) {
  const user = useAuth((s) => s.user);
  const setBalance = useAuth((s) => s.setBalance);
  const phase = useGame((s) => s.phase);
  const multiplier = useGame((s) => s.multiplier);

  const [amount, setAmount] = useState(1);
  const [autoCashout, setAutoCashout] = useState('');
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [cashedAt, setCashedAt] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  // reset per round
  useEffect(() => {
    if (phase === 'betting') {
      setPlaced(false);
      setCashedAt(null);
      setMsg('');
    }
  }, [phase]);

  const place = () => {
    if (!user) {
      setMsg('Please log in to bet');
      return;
    }
    getSocket().emit(
      EVENTS.PLACE_BET,
      { slot, amount, autoCashout: autoEnabled && autoCashout ? Number(autoCashout) : undefined },
      (res: { ok: boolean; balance?: number; error?: string }) => {
        if (res.ok) {
          setPlaced(true);
          if (res.balance !== undefined) setBalance(res.balance);
          setMsg('');
        } else {
          setMsg(res.error ?? 'Bet failed');
        }
      },
    );
  };

  const cashout = () => {
    getSocket().emit(
      EVENTS.CASHOUT,
      { slot },
      (res: { ok: boolean; payout?: number; multiplier?: number; balance?: number; error?: string }) => {
        if (res.ok) {
          setCashedAt(res.multiplier ?? null);
          if (res.balance !== undefined) setBalance(res.balance);
          setPlaced(false);
        } else {
          setMsg(res.error ?? 'Cashout failed');
        }
      },
    );
  };

  const canBet = phase === 'betting' && !placed;
  const canCashout = phase === 'running' && placed && cashedAt === null;
  const potential = (amount * multiplier).toFixed(2);

  return (
    <div className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-white/40">Bet {slot}</span>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input type="checkbox" checked={autoEnabled} onChange={(e) => setAutoEnabled(e.target.checked)} />
          Auto cashout
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn bg-base-600 text-white" onClick={() => setAmount((a) => Math.max(1, +(a / 2).toFixed(2)))}>
          ½
        </button>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          className="input text-center text-lg font-bold"
        />
        <button className="btn bg-base-600 text-white" onClick={() => setAmount((a) => +(a * 2).toFixed(2))}>
          2×
        </button>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        {QUICK.map((q) => (
          <button key={q} className="btn bg-base-700 text-sm text-white/80" onClick={() => setAmount(q)}>
            {q}
          </button>
        ))}
      </div>

      {autoEnabled && (
        <input
          type="number"
          step="0.1"
          min={1.01}
          placeholder="Auto cashout @ (e.g. 2.00)"
          value={autoCashout}
          onChange={(e) => setAutoCashout(e.target.value)}
          className="input mt-2"
        />
      )}

      <div className="mt-3">
        {canCashout ? (
          <motion.button
            className="btn-win w-full text-lg"
            onClick={cashout}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            Cash Out {potential}
          </motion.button>
        ) : cashedAt ? (
          <div className="btn-win w-full text-center text-lg">Cashed @ {cashedAt.toFixed(2)}x 🎉</div>
        ) : placed ? (
          <div className="btn w-full bg-base-600 text-center text-white/70">Waiting for round…</div>
        ) : (
          <button className="btn-primary w-full text-lg" onClick={place} disabled={!canBet}>
            Bet {amount.toFixed(2)}
          </button>
        )}
      </div>

      {msg && <p className="mt-2 text-center text-sm text-loss">{msg}</p>}
    </div>
  );
}

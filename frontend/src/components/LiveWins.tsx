'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSocket, EVENTS } from '@/lib/socket';

interface Win { id: number; username: string; multiplier: number; payout: number; }
let counter = 0;

export default function LiveWins() {
  const [wins, setWins] = useState<Win[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const onCashout = (c: { username: string; cashoutMultiplier: number; payout: number }) => {
      if (!c?.payout || c.payout <= 0) return;
      setWins((prev) => [{ id: ++counter, username: c.username, multiplier: c.cashoutMultiplier, payout: c.payout }, ...prev].slice(0, 12));
    };
    socket.on(EVENTS.BET_CASHOUT, onCashout);
    return () => { socket.off(EVENTS.BET_CASHOUT, onCashout); };
  }, []);

  if (wins.length === 0) return null;
  const tint = (m: number) => (m < 2 ? 'text-win' : m < 5 ? 'text-gold' : 'text-loss');

  return (
    <div className="glass flex items-center gap-3 overflow-hidden p-2.5">
      <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-win">🏆 Live wins</span>
      <div className="flex gap-2 overflow-x-auto">
        {wins.map((w) => (
          <div key={w.id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-base-700/60 px-3 py-1 text-xs">
            <Link href={`/u/${w.username}`} className="max-w-[80px] truncate text-white/70 hover:text-accent-glow">{w.username}</Link>
            <span className={`font-bold ${tint(w.multiplier)}`}>{w.multiplier?.toFixed(2)}x</span>
            <span className="font-bold text-win">+₹{w.payout.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

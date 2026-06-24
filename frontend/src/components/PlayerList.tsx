'use client';

import { useGame } from '@/lib/store';

export default function PlayerList() {
  const players = useGame((s) => s.players);
  const total = players.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="glass flex h-full flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">Live Bets</h3>
        <span className="text-xs text-white/50">
          {players.length} players · ₹{total.toFixed(0)} wagered
        </span>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {players.length === 0 && <p className="text-sm text-white/30">No bets this round yet.</p>}
        {players.map((p, i) => (
          <div
            key={`${p.username}-${p.slot}-${i}`}
            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
              p.status === 'cashed-out' ? 'bg-win/10' : 'bg-base-700/40'
            }`}
          >
            <span className="truncate text-white/80">{p.username}</span>
            <span className="text-white/50">₹{p.amount.toFixed(2)}</span>
            <span className={p.status === 'cashed-out' ? 'font-bold text-win' : 'text-white/30'}>
              {p.cashoutMultiplier ? `${p.cashoutMultiplier.toFixed(2)}x` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

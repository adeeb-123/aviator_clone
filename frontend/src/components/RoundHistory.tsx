'use client';

import { useGame } from '@/lib/store';

export default function RoundHistory() {
  const history = useGame((s) => s.history);

  const tint = (m: number) => (m < 2 ? 'text-win bg-win/10' : m < 5 ? 'text-gold bg-gold/10' : 'text-loss bg-loss/10');

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {history.length === 0 && <span className="text-sm text-white/30">No rounds yet…</span>}
      {history.map((r) => (
        <span
          key={r.roundId}
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${tint(r.crashPoint)}`}
          title={`Round #${r.roundId}`}
        >
          {r.crashPoint.toFixed(2)}x
        </span>
      ))}
    </div>
  );
}

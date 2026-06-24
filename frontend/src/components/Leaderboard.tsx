'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getSocket, EVENTS } from '@/lib/socket';
import type { LeaderboardEntry } from '@/types';

type Range = 'today' | 'week' | 'all';

export default function Leaderboard() {
  const [range, setRange] = useState<Range>('today');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const load = async (r: Range) => {
    const { data } = await api.get('/game/leaderboard', { params: { range: r } });
    setEntries(data.leaderboard);
  };

  useEffect(() => {
    void load(range);
  }, [range]);

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (board: LeaderboardEntry[]) => {
      if (range === 'today') setEntries(board);
    };
    socket.on(EVENTS.LEADERBOARD_UPDATE, onUpdate);
    return () => {
      socket.off(EVENTS.LEADERBOARD_UPDATE, onUpdate);
    };
  }, [range]);

  const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`;

  return (
    <div className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">🏆 Top Winners</h3>
        <div className="flex gap-1 text-xs">
          {(['today', 'week', 'all'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded px-2 py-1 capitalize ${range === r ? 'bg-accent text-white' : 'text-white/50'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        {entries.length === 0 && <p className="text-sm text-white/30">No winners yet.</p>}
        {entries.map((e, i) => (
          <div key={e.userId} className="flex items-center justify-between rounded-lg bg-base-700/40 px-2 py-1.5 text-sm">
            <span className="w-6 text-center">{medal(i)}</span>
            <span className="flex-1 truncate px-2 text-white/80">{e.username}</span>
            <span className="text-xs text-white/40">{e.bestMultiplier?.toFixed(2)}x</span>
            <span className="ml-2 font-bold text-win">+₹{e.totalPayout.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

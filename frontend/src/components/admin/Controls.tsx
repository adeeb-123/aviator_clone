'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useGame } from '@/lib/store';

export default function Controls() {
  const phase = useGame((s) => s.phase);
  const multiplier = useGame((s) => s.multiplier);
  const roundId = useGame((s) => s.roundId);
  const [crash, setCrash] = useState('2.0');
  const [seed, setSeed] = useState<{ activeHash: string; nonce: number; expiresAt: string } | null>(null);
  const [msg, setMsg] = useState('');

  const loadSeed = () => api.get('/admin/seed').then((r) => setSeed(r.data)).catch(() => {});
  useEffect(() => { loadSeed(); }, []);

  const act = async (fn: () => Promise<unknown>, label: string) => {
    setMsg('');
    try { await fn(); setMsg(`${label} ✓`); loadSeed(); } catch { setMsg(`${label} failed`); }
  };

  return (
    <div className="space-y-5">
      {/* live status */}
      <div className="glass flex flex-wrap items-center gap-6 p-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/40">Live round</div>
          <div className="text-lg font-bold text-accent-glow">#{roundId} · <span className="capitalize">{phase}</span></div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/40">Multiplier</div>
          <div className="text-lg font-bold text-win">{multiplier.toFixed(2)}x</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* game controls */}
        <div className="glass space-y-4 p-4">
          <h3 className="font-semibold">Game controls</h3>
          <div className="flex gap-2">
            <button className="btn bg-base-600 text-white" onClick={() => act(() => api.post('/admin/game/pause', { paused: true }), 'Pause')}>⏸ Pause</button>
            <button className="btn-win" onClick={() => act(() => api.post('/admin/game/pause', { paused: false }), 'Resume')}>▶ Resume</button>
          </div>
          <div>
            <label className="text-xs text-white/50">Force next crash point (testing)</label>
            <div className="mt-1 flex items-center gap-2">
              <input className="input max-w-[120px]" value={crash} onChange={(e) => setCrash(e.target.value)} />
              <button className="btn-loss" onClick={() => act(() => api.post('/admin/game/force-crash', { crashPoint: Number(crash) }), 'Force crash')}>Force crash</button>
            </div>
            <p className="mt-1 text-[11px] text-gold/70">⚠ Overrides provably-fair for that round — testing only.</p>
          </div>
        </div>

        {/* seed management */}
        <div className="glass space-y-3 p-4">
          <h3 className="font-semibold">Provably-fair seed</h3>
          <div className="rounded-lg bg-base-700/40 p-3 text-xs">
            <div className="text-white/50">Active server seed hash (committed)</div>
            <div className="mt-1 break-all font-mono text-white/80">{seed?.activeHash ?? '…'}</div>
            <div className="mt-1 text-white/40">nonce: {seed?.nonce ?? '—'}</div>
          </div>
          <button className="btn-primary text-sm" onClick={() => act(() => api.post('/admin/seed/rotate'), 'Rotate seed')}>Rotate &amp; reveal seed</button>
        </div>
      </div>

      {msg && <p className="text-sm text-gold">{msg}</p>}
    </div>
  );
}

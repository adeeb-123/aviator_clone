'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useGame } from '@/lib/store';
import { useAutoRefresh } from '@/lib/useAutoRefresh';

interface Status {
  paused: boolean;
  forcedCrashQueue: number[];
  phase: string;
  roundId: number;
  running: boolean;
}

export default function Controls() {
  const phase = useGame((s) => s.phase);
  const multiplier = useGame((s) => s.multiplier);
  const roundId = useGame((s) => s.roundId);
  const [status, setStatus] = useState<Status | null>(null);
  const [crash, setCrash] = useState('2.0');
  const [seed, setSeed] = useState<{ activeHash: string; nonce: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    const [s, sd] = await Promise.all([api.get('/admin/game/status'), api.get('/admin/seed')]);
    setStatus(s.data);
    setSeed(sd.data);
  };
  const { refresh } = useAutoRefresh(loadStatus, 4000);

  // run an action whose response IS the new status, and reflect it instantly
  const act = async (p: Promise<{ data: Status }>) => {
    setBusy(true);
    try {
      const r = await p;
      if (r?.data) setStatus(r.data);
    } finally {
      setBusy(false);
    }
  };

  const paused = status?.paused ?? false;
  const queue = status?.forcedCrashQueue ?? [];
  const roundInProgress = phase === 'running' || phase === 'betting';

  return (
    <div className="space-y-5">
      {/* live status strip */}
      <div className="glass flex flex-wrap items-center gap-6 p-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-white/40">Engine state</div>
          {paused ? (
            <div className="text-lg font-black text-gold">⏸ PAUSED</div>
          ) : (
            <div className="text-lg font-black text-win">▶ LIVE</div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/40">Round</div>
          <div className="text-lg font-bold text-accent-glow">#{roundId} · <span className="capitalize">{phase}</span></div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/40">Multiplier</div>
          <div className="text-lg font-bold text-win tabular-nums">{multiplier.toFixed(2)}x</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* game controls */}
        <div className="glass space-y-4 p-4">
          <h3 className="font-semibold">Game controls</h3>

          {/* persistent pause-state banner */}
          <div className={`rounded-lg border p-3 text-sm ${paused ? 'border-gold/50 bg-gold/10 text-gold' : 'border-win/40 bg-win/10 text-win'}`}>
            {paused ? (
              <>
                <b>⏸ Game paused.</b>{' '}
                {roundInProgress
                  ? `Takes effect after round #${roundId} finishes — then no new rounds will start.`
                  : 'No new rounds are starting until you resume.'}
              </>
            ) : (
              <><b>▶ Running normally.</b> New rounds start automatically.</>
            )}
          </div>

          <div className="flex gap-2">
            <button
              disabled={busy || paused}
              className={`btn ${paused ? 'bg-base-700 text-white/40' : 'bg-base-600 text-white ring-1 ring-white/10'}`}
              onClick={() => act(api.post('/admin/game/pause', { paused: true }))}
            >
              ⏸ Pause
            </button>
            <button
              disabled={busy || !paused}
              className={`btn ${!paused ? 'bg-base-700 text-white/40' : 'btn-win ring-2 ring-win/50'}`}
              onClick={() => act(api.post('/admin/game/pause', { paused: false }))}
            >
              ▶ Resume
            </button>
          </div>

          {/* force-crash queue */}
          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/50">Force-crash queue (fires in order, testing)</label>
              {queue.length > 0 && (
                <button disabled={busy} className="text-[11px] text-loss hover:underline" onClick={() => act(api.post('/admin/game/clear-crash'))}>
                  Clear all
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <input
                className="input max-w-[120px]"
                type="number"
                step="0.1"
                min="1"
                value={crash}
                onChange={(e) => setCrash(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && Number(crash) >= 1 && act(api.post('/admin/game/force-crash', { crashPoint: Number(crash) }))}
              />
              <button disabled={busy || !(Number(crash) >= 1)} className="btn-loss" onClick={() => act(api.post('/admin/game/force-crash', { crashPoint: Number(crash) }))}>
                + Add to queue
              </button>
            </div>

            {queue.length === 0 ? (
              <p className="mt-2 text-xs text-white/30">No forced crashes queued — rounds are provably fair.</p>
            ) : (
              <div className="mt-2.5">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] text-white/40">
                  <span>Upcoming rounds</span>
                  <span className="text-white/20">— round #{roundId + 1} onward, left → right</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {queue.map((cp, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm ${i === 0 ? 'border-loss/60 bg-loss/15' : 'border-white/10 bg-base-700/50'}`}
                      title={`Round #${roundId + 1 + i}`}
                    >
                      <span className={`text-[10px] font-bold ${i === 0 ? 'text-loss' : 'text-white/40'}`}>{i === 0 ? 'NEXT' : `#${i + 1}`}</span>
                      <span className="font-bold tabular-nums text-white/90">{cp.toFixed(2)}x</span>
                      <button
                        disabled={busy}
                        aria-label="Remove"
                        className="ml-0.5 rounded text-white/40 hover:text-loss"
                        onClick={() => act(api.post('/admin/game/clear-crash', { index: i }))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-gold/70">⚠ Each forces one round&apos;s outcome (overrides provably-fair).</p>
              </div>
            )}
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
          <button disabled={busy} className="btn-primary text-sm" onClick={async () => { setBusy(true); try { await api.post('/admin/seed/rotate'); await refresh(); } finally { setBusy(false); } }}>
            Rotate &amp; reveal seed
          </button>
        </div>
      </div>
    </div>
  );
}

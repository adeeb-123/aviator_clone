'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { api } from '@/lib/api';

interface SeedRow {
  seed: string;
  hash: string;
  createdAt: string;
  revealedAt?: string;
}

export default function FairnessPage() {
  const [form, setForm] = useState({ serverSeed: '', clientSeed: '', nonce: '0' });
  const [result, setResult] = useState<{ crashPoint: number; serverSeedHash: string; hmac: string } | null>(null);
  const [seeds, setSeeds] = useState<SeedRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/game/seeds')
      .then(({ data }) => setSeeds(data.seeds))
      .catch(() => {});
  }, []);

  const verify = async () => {
    setError('');
    try {
      const { data } = await api.get('/game/verify', { params: form });
      setResult(data);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Verification failed');
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-black">Provably Fair</h1>
          <p className="mt-2 text-white/60">
            Every round&apos;s crash point is <code>HMAC_SHA256(serverSeed, clientSeed:nonce)</code> mapped to a
            multiplier. We publish <code>SHA256(serverSeed)</code> before each round and reveal the raw server seed
            after rotation, so you can independently recompute any result.
          </p>
        </div>

        <div className="glass space-y-3 p-6">
          <h2 className="font-semibold">Verify a round</h2>
          <input
            className="input"
            placeholder="Server seed (revealed)"
            value={form.serverSeed}
            onChange={(e) => setForm({ ...form, serverSeed: e.target.value })}
          />
          <input
            className="input"
            placeholder="Client seed"
            value={form.clientSeed}
            onChange={(e) => setForm({ ...form, clientSeed: e.target.value })}
          />
          <input
            className="input"
            placeholder="Nonce"
            value={form.nonce}
            onChange={(e) => setForm({ ...form, nonce: e.target.value })}
          />
          <button className="btn-primary" onClick={verify}>
            Verify
          </button>
          {error && <p className="text-loss">{error}</p>}
          {result && (
            <div className="rounded-lg bg-base-700/60 p-4 font-mono text-sm">
              <div>
                Crash point: <span className="font-bold text-win">{result.crashPoint.toFixed(2)}x</span>
              </div>
              <div className="mt-1 break-all text-white/50">serverSeedHash: {result.serverSeedHash}</div>
              <div className="mt-1 break-all text-white/50">hmac: {result.hmac}</div>
            </div>
          )}
        </div>

        <div className="glass p-6">
          <h2 className="mb-3 font-semibold">Revealed server seeds</h2>
          <div className="space-y-2 text-xs">
            {seeds.length === 0 && <p className="text-white/30">No revealed seeds yet.</p>}
            {seeds.map((s) => (
              <div key={s.hash} className="rounded bg-base-700/40 p-2 font-mono">
                <div className="break-all text-white/70">seed: {s.seed}</div>
                <div className="break-all text-white/40">hash: {s.hash}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Header from '@/components/Header';
import { api } from '@/lib/api';
import { useAuth, useGame } from '@/lib/store';

interface Dash {
  totals: { users: number; rounds: number; wagered: number; payout: number; revenue: number };
}
interface AdminUser {
  _id: string;
  username: string;
  email: string;
  balance: number;
  isBanned: boolean;
  role: string;
}

export default function AdminPage() {
  const user = useAuth((s) => s.user);
  const phase = useGame((s) => s.phase);
  const multiplier = useGame((s) => s.multiplier);
  const [dash, setDash] = useState<Dash | null>(null);
  const [series, setSeries] = useState<{ date: string; revenue: number }[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [crash, setCrash] = useState('2.0');
  const [seed, setSeed] = useState<{ activeHash: string; nonce: number } | null>(null);
  const [msg, setMsg] = useState('');

  const refresh = async () => {
    const [d, r, u, s] = await Promise.all([
      api.get('/admin/dashboard'),
      api.get('/admin/revenue'),
      api.get('/admin/users'),
      api.get('/admin/seed'),
    ]);
    setDash(d.data);
    setSeries(r.data.series);
    setUsers(u.data.users);
    setSeed(s.data);
  };

  useEffect(() => {
    if (user?.role === 'admin') void refresh().catch(() => setMsg('Failed to load (admin only)'));
  }, [user]);

  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen">
        <Header />
        <p className="p-8 text-center text-loss">Admin access required.</p>
      </div>
    );
  }

  const act = async (fn: () => Promise<unknown>, label: string) => {
    try {
      await fn();
      setMsg(`${label} ✓`);
      void refresh();
    } catch {
      setMsg(`${label} failed`);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black">Admin Dashboard</h1>
          <div className="glass px-4 py-2 text-sm">
            Live: <span className="font-bold capitalize text-accent-glow">{phase}</span> · {multiplier.toFixed(2)}x
          </div>
        </div>
        {msg && <p className="text-sm text-gold">{msg}</p>}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {dash &&
            [
              ['Users', dash.totals.users],
              ['Rounds', dash.totals.rounds],
              ['Wagered', '₹' + dash.totals.wagered.toFixed(0)],
              ['Payout', '₹' + dash.totals.payout.toFixed(0)],
              ['Revenue', '₹' + dash.totals.revenue.toFixed(0)],
            ].map(([label, val]) => (
              <div key={label as string} className="glass p-4">
                <div className="text-xs uppercase tracking-widest text-white/40">{label}</div>
                <div className="text-2xl font-black text-win">{val}</div>
              </div>
            ))}
        </div>

        {/* revenue chart */}
        <div className="glass p-4">
          <h2 className="mb-2 font-semibold">Revenue (last 30 days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} />
                <Tooltip contentStyle={{ background: '#181826', border: 'none', borderRadius: 8 }} />
                <Line type="monotone" dataKey="revenue" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* game controls */}
          <div className="glass space-y-3 p-4">
            <h2 className="font-semibold">Game Controls</h2>
            <div className="flex gap-2">
              <button className="btn bg-base-600 text-white" onClick={() => act(() => api.post('/admin/game/pause', { paused: true }), 'Pause')}>
                Pause
              </button>
              <button className="btn-win" onClick={() => act(() => api.post('/admin/game/pause', { paused: false }), 'Resume')}>
                Resume
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input className="input max-w-[120px]" value={crash} onChange={(e) => setCrash(e.target.value)} />
              <button
                className="btn-loss"
                onClick={() => act(() => api.post('/admin/game/force-crash', { crashPoint: Number(crash) }), 'Force crash')}
              >
                Force next crash
              </button>
            </div>
            <div className="rounded-lg bg-base-700/40 p-3 text-xs">
              <div className="text-white/50">Active server seed hash</div>
              <div className="break-all font-mono text-white/70">{seed?.activeHash}</div>
              <div className="mt-1 text-white/40">nonce: {seed?.nonce}</div>
              <button className="btn-primary mt-2 text-sm" onClick={() => act(() => api.post('/admin/seed/rotate'), 'Rotate seed')}>
                Rotate seed
              </button>
            </div>
          </div>

          {/* player management */}
          <div className="glass p-4">
            <h2 className="mb-2 font-semibold">Players</h2>
            <div className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {users.map((u) => (
                <div key={u._id} className="flex items-center justify-between rounded bg-base-700/40 px-2 py-1.5">
                  <span className="flex-1 truncate">
                    {u.username} <span className="text-white/30">· ₹{u.balance.toFixed(0)}</span>
                  </span>
                  <button
                    className="btn bg-base-600 px-2 py-1 text-xs"
                    onClick={() => act(() => api.post('/admin/balance', { userId: u._id, amount: 100, reason: 'Admin grant' }), 'Grant 100')}
                  >
                    +₹100
                  </button>
                  <button
                    className={`btn px-2 py-1 text-xs ${u.isBanned ? 'btn-win' : 'btn-loss'}`}
                    onClick={() => act(() => api.patch(`/admin/users/${u._id}`, { isBanned: !u.isBanned }), u.isBanned ? 'Unban' : 'Ban')}
                  >
                    {u.isBanned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

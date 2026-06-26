'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';

interface Action { _id: string; adminUsername: string; action: string; detail: string; meta?: Record<string, unknown>; createdAt: string }

const ICON: Record<string, string> = {
  'force-crash': '💥', 'balance-adjust': '💰', 'user-flag': '🚩', 'game-pause': '⏸️',
  'seed-rotate': '🔑', 'config-update': '⚙️', 'broadcast': '📢', 'chat-delete': '🗑️',
  'chat-mute': '🔇', 'chat-unmute': '🔊',
};

export default function Audit() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/actions', { params: { limit: 150 } })
      .then((r) => setActions(r.data.actions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="glass overflow-x-auto p-0">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
            <th className="p-3">When</th>
            <th className="p-3">Admin</th>
            <th className="p-3">Action</th>
            <th className="p-3">Detail</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a._id} className="border-b border-white/5 hover:bg-white/5">
              <td className="whitespace-nowrap p-3 text-white/50">{dt(a.createdAt)}</td>
              <td className="p-3 font-semibold">@{a.adminUsername}</td>
              <td className="p-3"><span className="rounded bg-base-700 px-2 py-0.5 text-xs">{ICON[a.action] ?? '•'} {a.action}</span></td>
              <td className="p-3 text-white/70">{a.detail}</td>
            </tr>
          ))}
          {!loading && actions.length === 0 && (
            <tr><td colSpan={4} className="p-8 text-center text-white/40">No admin actions logged yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

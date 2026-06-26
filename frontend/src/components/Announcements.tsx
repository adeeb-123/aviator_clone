'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';

interface Announcement { id: string; message: string; severity: 'info' | 'warning' }

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    const s = getSocket();
    const onAnn = (a: Announcement) => setItems((prev) => [a, ...prev].slice(0, 3));
    s.on('announcement', onAnn);
    return () => { s.off('announcement', onAnn); };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="sticky top-0 z-40 space-y-px">
      {items.map((a) => (
        <div key={a.id} className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium ${a.severity === 'warning' ? 'bg-gold text-base-900' : 'bg-accent text-white'}`}>
          <span className="flex items-center gap-2">📢 {a.message}</span>
          <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== a.id))} aria-label="Dismiss" className="shrink-0 rounded px-2 text-lg leading-none opacity-70 hover:opacity-100">×</button>
        </div>
      ))}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface Props {
  auto: boolean;
  setAuto: (v: boolean) => void;
  updatedAt: number | null;
  onRefresh: () => void;
  children?: React.ReactNode; // extra controls (e.g. export)
}

export default function RefreshBar({ auto, setAuto, updatedAt, onRefresh, children }: Props) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const ago = updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
      {children}
      <span className={ago !== null && ago > 60 ? 'text-gold/70' : ''}>
        {ago === null ? '—' : ago < 2 ? 'updated just now' : `updated ${ago}s ago`}
      </span>
      <label className="flex cursor-pointer items-center gap-1.5 select-none">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        auto
      </label>
      <button onClick={onRefresh} className="rounded bg-base-600 px-2.5 py-1 font-semibold text-white/80 hover:bg-base-700">
        ↻ Refresh
      </button>
    </div>
  );
}

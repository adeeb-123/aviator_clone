'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/socket';
import { sound } from '@/lib/sound';

interface Note { id: string; kind: 'success' | 'error' | 'info'; title: string; message: string }

const STYLE: Record<string, { border: string; icon: string; accent: string }> = {
  success: { border: 'border-win/60', icon: '✅', accent: 'bg-win' },
  error: { border: 'border-loss/60', icon: '❌', accent: 'bg-loss' },
  info: { border: 'border-accent/60', icon: '🔔', accent: 'bg-accent' },
};

const AUTO_MS = 12000;

export default function Notifications() {
  const [items, setItems] = useState<Note[]>([]);

  useEffect(() => {
    const s = getSocket();
    const onNote = (n: Note) => {
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 4));
      if (n.kind === 'success') sound.reward(); else sound.cashout();
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== n.id)), AUTO_MS);
    };
    s.on('user:notify', onNote);
    return () => { s.off('user:notify', onNote); };
  }, []);

  const dismiss = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));
  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {items.map((n) => {
          const s = STYLE[n.kind] ?? STYLE.info;
          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 48, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={`pointer-events-auto flex overflow-hidden rounded-xl border bg-base-900/95 shadow-glow backdrop-blur-lg ${s.border}`}
            >
              <div className={`w-1 shrink-0 ${s.accent}`} />
              <div className="flex items-start gap-2.5 p-3 pr-2">
                <span className="mt-0.5 text-lg">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{n.title}</div>
                  <p className="mt-0.5 break-words text-xs leading-snug text-white/70">{n.message}</p>
                </div>
                <button onClick={() => dismiss(n.id)} aria-label="Dismiss" className="shrink-0 rounded px-1.5 text-lg leading-none text-white/30 transition hover:text-white">×</button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '@/lib/socket';

interface Announcement { id: string; message: string; severity: 'info' | 'warning' }

const AUTO_DISMISS_MS = 15000;

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    const s = getSocket();
    const onAnn = (a: Announcement) => {
      setItems((prev) => [a, ...prev.filter((x) => x.id !== a.id)].slice(0, 3));
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== a.id)), AUTO_DISMISS_MS);
    };
    s.on('announcement', onAnn);
    return () => { s.off('announcement', onAnn); };
  }, []);

  const dismiss = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    // pointer-events-none on the wrapper so empty space never blocks the bet panel;
    // only the cards themselves capture clicks.
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[calc(100%-2rem)] max-w-[20rem] flex-col-reverse gap-2 sm:max-w-sm">
      <AnimatePresence initial={false}>
        {items.map((a) => {
          const warn = a.severity === 'warning';
          return (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, x: -48, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -48, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={`pointer-events-auto overflow-hidden rounded-xl border bg-base-900/95 shadow-glow backdrop-blur-lg ${warn ? 'border-gold/60' : 'border-accent/60'}`}
            >
              <div className="flex items-start gap-3 p-3 pr-2">
                <span className={`relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${warn ? 'bg-gold/20' : 'bg-accent/20'}`}>
                  <motion.span animate={{ rotate: [0, -12, 12, -8, 8, 0] }} transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2.5 }}>📢</motion.span>
                  <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-ping rounded-full ${warn ? 'bg-gold' : 'bg-accent-glow'}`} />
                  <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ${warn ? 'bg-gold' : 'bg-accent-glow'}`} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className={`text-[10px] font-extrabold uppercase tracking-[0.15em] ${warn ? 'text-gold' : 'text-accent-glow'}`}>
                    {warn ? '⚠ Important' : 'Announcement'}
                  </div>
                  <p className="mt-0.5 break-words text-sm leading-snug text-white/90">{a.message}</p>
                </div>
                <button onClick={() => dismiss(a.id)} aria-label="Dismiss" className="shrink-0 rounded px-1.5 text-lg leading-none text-white/30 transition hover:text-white">×</button>
              </div>
              {/* auto-dismiss countdown bar */}
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: 0 }}
                transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
                className={`h-0.5 ${warn ? 'bg-gold' : 'bg-accent-glow'}`}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

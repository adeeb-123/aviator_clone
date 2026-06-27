'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/lib/store';
import { inr } from '@/lib/format';

export default function JackpotWidget() {
  const jackpot = useGame((s) => s.jackpot);
  const enabled = useGame((s) => s.jackpotEnabled);
  const trigger = useGame((s) => s.jackpotTrigger);
  const [won, setWon] = useState<{ username: string; amount: number } | null>(null);

  useEffect(() => {
    const onWon = (e: Event) => {
      setWon((e as CustomEvent).detail);
      const id = setTimeout(() => setWon(null), 9000);
      return () => clearTimeout(id);
    };
    window.addEventListener('jackpot-won', onWon);
    return () => window.removeEventListener('jackpot-won', onWon);
  }, []);

  if (!enabled) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gold/40 bg-gradient-to-r from-gold/15 via-amber-500/10 to-gold/15 px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎰</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-gold">Jackpot</span>
        </div>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={jackpot}
            initial={{ scale: 1.25, color: '#fde68a' }}
            animate={{ scale: 1, color: '#f5b50a' }}
            className="text-2xl font-black tabular-nums"
          >
            {inr(jackpot)}
          </motion.span>
        </AnimatePresence>
        <span className="hidden text-[11px] text-white/50 sm:block">Cash out at <b className="text-gold">{trigger}x+</b> to win it!</span>
      </div>

      <AnimatePresence>
        {won && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center gap-2 bg-gradient-to-r from-gold/90 to-amber-500/90 text-sm font-black text-base-900"
          >
            🎉 @{won.username} just won the {inr(won.amount)} JACKPOT! 🎉
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useGame } from '@/lib/store';
import { useT } from '@/lib/i18n';

export default function MultiplierDisplay() {
  const { t } = useT();
  const phase = useGame((s) => s.phase);
  const multiplier = useGame((s) => s.multiplier);
  const crashPoint = useGame((s) => s.crashPoint);
  const bettingEndsAt = useGame((s) => s.bettingEndsAt);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (phase !== 'betting' || !bettingEndsAt) return;
    const id = setInterval(() => {
      setCountdown(Math.max(0, (bettingEndsAt - Date.now()) / 1000));
    }, 100);
    return () => clearInterval(id);
  }, [phase, bettingEndsAt]);

  const color = multiplier < 2 ? '#22d39a' : multiplier < 5 ? '#f5b50a' : '#ef4444';

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {phase === 'betting' && (
          <motion.div
            key="betting"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <div className="text-xs uppercase tracking-widest text-white/50 sm:text-sm">{t('game.nextRound')}</div>
            <div className="text-5xl font-bold text-accent-glow sm:text-6xl">{countdown.toFixed(1)}s</div>
            <div className="mt-2 text-white/40">{t('game.placeBets')}</div>
          </motion.div>
        )}

        {phase === 'running' && (
          <motion.div
            key="running"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="text-center"
            style={{ color }}
          >
            <motion.div
              className="text-6xl font-black tabular-nums sm:text-7xl md:text-8xl"
              style={{ textShadow: `0 0 40px ${color}` }}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
            >
              {multiplier.toFixed(2)}x
            </motion.div>
          </motion.div>
        )}

        {phase === 'crashed' && (
          <motion.div
            key="crashed"
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="text-xl font-semibold uppercase tracking-widest text-loss sm:text-2xl">{t('game.flewAway')}</div>
            <div className="text-6xl font-black text-loss sm:text-7xl" style={{ textShadow: '0 0 40px #ef4444' }}>
              {(crashPoint ?? multiplier).toFixed(2)}x
            </div>
          </motion.div>
        )}

        {phase === 'idle' && (
          <motion.div key="idle" className="text-white/40">
            Connecting to game…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

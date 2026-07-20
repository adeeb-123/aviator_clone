'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import MaintenanceIllustration from './MaintenanceIllustration';
import AuthModal from './AuthModal';
import { useMaintenance } from '@/lib/maintenance';

/** Floating, blurred colour blobs behind the card (decorative). */
function Blobs({ reduce }: { reduce: boolean | null }) {
  const blobs = [
    { className: 'left-[-6rem] top-[-4rem] bg-accent/30', d: 0 },
    { className: 'right-[-8rem] top-1/3 bg-win/20', d: 2 },
    { className: 'bottom-[-6rem] left-1/4 bg-accent-glow/20', d: 1 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute h-72 w-72 rounded-full blur-3xl ${b.className}`}
          {...(reduce ? {} : {
            animate: { y: [0, -24, 0], x: [0, 14, 0], scale: [1, 1.08, 1] },
            transition: { duration: 10 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: b.d },
          })}
        />
      ))}
    </div>
  );
}

export default function MaintenancePage() {
  const { message, updatedAt } = useMaintenance();
  const reduce = useReducedMotion();
  const [now, setNow] = useState('');
  const [authOpen, setAuthOpen] = useState(false);

  // Live clock.
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const updatedLabel =
    updatedAt && new Date(updatedAt).getTime() > 0
      ? new Date(updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : null;

  return (
    <main
      role="main"
      aria-live="polite"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
    >
      <Blobs reduce={reduce} />

      <motion.section
        initial={reduce ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="glass relative z-10 w-full max-w-5xl p-6 shadow-glow transition-shadow duration-500 hover:shadow-[0_0_60px_-10px_rgba(168,85,247,0.6)] sm:p-10"
      >
        <div className="grid items-center gap-8 md:grid-cols-2">
          {/* Illustration — top on mobile, left on desktop */}
          <motion.div
            className="order-1 flex justify-center md:order-none"
            {...(reduce ? {} : { animate: { y: [0, -8, 0] }, transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' } })}
          >
            <MaintenanceIllustration className="w-full max-w-sm" />
          </motion.div>

          {/* Content — below on mobile, right on desktop */}
          <div className="order-2 text-center md:order-none md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-glow">
              <span className={`h-1.5 w-1.5 rounded-full bg-accent-glow ${reduce ? '' : 'animate-pulseGlow'}`} />
              Under maintenance
            </span>

            <h1 className="mt-4 bg-gradient-to-r from-accent-glow via-white to-win bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-4xl lg:text-5xl">
              {message}
            </h1>

            <p className="mt-4 text-sm text-white/50 sm:text-base">
              We&rsquo;re making things even better — thanks for your patience&nbsp;❤️
            </p>

            {/* Live clock + last-updated */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-base-700/60 px-3 py-1.5 font-mono text-sm text-white/80">
                <span className={`h-2 w-2 rounded-full bg-win ${reduce ? '' : 'animate-pulse'}`} aria-hidden />
                <span aria-label="Current time">{now || '--:--:--'}</span>
              </div>
              {updatedLabel && (
                <span className="text-xs text-white/30">status since {updatedLabel}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer — brand + discreet admin access */}
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-white/5 pt-4 text-xs text-white/30 sm:flex-row">
          <span className="font-black tracking-widest text-white/40">
            AVIA<span className="text-accent-glow">TOR</span>
          </span>
          <button
            onClick={() => setAuthOpen(true)}
            className="rounded-md px-2 py-1 text-accent-glow/80 transition hover:bg-white/5 hover:text-accent-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-glow"
          >
            Are you an admin? Sign in →
          </button>
        </div>
      </motion.section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}

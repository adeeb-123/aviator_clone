'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: Props) {
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', referralCode: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Portal target — only available after mount (avoids SSR mismatch). Rendering
  // into document.body lets the fixed overlay escape the Header's backdrop-blur
  // containing block, so it covers the full viewport and centers correctly.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Capture ?ref=CODE from a referral link → prefill code + default to register.
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) { setForm((f) => ({ ...f, referralCode: ref })); setMode('register'); }
  }, []);

  // Lock body scroll while open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.username, form.email, form.password, form.referralCode || undefined);
      }
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Something went wrong';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass w-full max-w-md p-6"
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg px-2 text-xl text-white/40 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="my-4 flex gap-2">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError('');
                  }}
                  className={`flex-1 rounded-lg py-2 font-semibold capitalize transition ${
                    mode === m ? 'bg-accent text-white' : 'bg-base-700 text-white/50 hover:text-white/80'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {mode === 'register' && (
              <input
                className="input mb-2"
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            )}
            <input
              className="input mb-2"
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="input mb-2"
              placeholder="Password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
            {mode === 'register' && (
              <input
                className="input mb-2"
                placeholder="Referral code (optional)"
                value={form.referralCode}
                onChange={(e) => setForm({ ...form, referralCode: e.target.value })}
              />
            )}

            {error && <p className="mb-2 text-sm text-loss">{error}</p>}

            <button className="btn-primary mt-2 w-full" onClick={() => void submit()} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
            </button>

            {mode === 'login' ? (
              <p className="mt-3 text-center text-xs text-white/40">
                New here?{' '}
                <button className="text-accent-glow hover:underline" onClick={() => setMode('register')}>
                  Create an account
                </button>
              </p>
            ) : (
              <p className="mt-3 text-center text-xs text-white/40">Get ₹100 free credits on signup 🎁</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

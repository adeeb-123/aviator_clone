'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/store';
import { api } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Mode = 'login' | 'register' | 'forgot';

export default function AuthModal({ open, onClose }: Props) {
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', referralCode: '' });
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) { setForm((f) => ({ ...f, referralCode: ref })); setMode('register'); }
  }, []);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setInfo('');
    setNeeds2fa(false);
    setTwoFactorCode('');
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password, needs2fa ? twoFactorCode : undefined);
        onClose();
      } else if (mode === 'register') {
        await register(form.username, form.email, form.password, form.referralCode || undefined);
        onClose();
      } else {
        // forgot password — always succeeds (no account enumeration)
        await api.post('/auth/forgot-password', { email: form.email });
        setInfo('If an account exists for that email, a reset link is on its way. Check your inbox.');
      }
    } catch (e: unknown) {
      const res = (e as { response?: { data?: { error?: string; twoFactorRequired?: boolean } } })?.response;
      if (res?.data?.twoFactorRequired) {
        setNeeds2fa(true);
        setError(needs2fa ? 'Invalid code — try again.' : '');
        setInfo('Enter the 6-digit code from your authenticator app.');
      } else {
        setError(res?.data?.error ?? 'Something went wrong');
      }
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  const title = mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset your password';

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
              <h2 className="text-lg font-bold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 text-xl text-white/40 hover:text-white">×</button>
            </div>

            {mode !== 'forgot' && (
              <div className="my-4 flex gap-2">
                {(['login', 'register'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`flex-1 rounded-lg py-2 font-semibold capitalize transition ${
                      mode === m ? 'bg-accent text-white' : 'bg-base-700 text-white/50 hover:text-white/80'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

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

            {mode !== 'forgot' && (
              <input
                className="input mb-2"
                placeholder="Password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
              />
            )}

            {mode === 'login' && needs2fa && (
              <input
                className="input mb-2 tracking-[0.4em]"
                placeholder="2FA code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                autoFocus
              />
            )}

            {mode === 'register' && (
              <input
                className="input mb-2"
                placeholder="Referral code (optional)"
                value={form.referralCode}
                onChange={(e) => setForm({ ...form, referralCode: e.target.value })}
              />
            )}

            {info && (
              <div className="mb-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-white/80">{info}</div>
            )}
            {error && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-loss/40 bg-loss/15 px-3 py-2 text-sm text-loss">
                <span className="shrink-0">⚠️</span><span>{error}</span>
              </div>
            )}

            <button className="btn-primary mt-2 w-full" onClick={() => void submit()} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Login' : mode === 'register' ? 'Create account' : 'Send reset link'}
            </button>

            {mode === 'login' && (
              <p className="mt-3 text-center text-xs text-white/40">
                <button className="text-accent-glow hover:underline" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p className="mt-3 text-center text-xs text-white/40">
                <button className="text-accent-glow hover:underline" onClick={() => switchMode('login')}>
                  ← Back to login
                </button>
              </p>
            )}
            {mode === 'register' && (
              <p className="mt-3 text-center text-xs text-white/40">Get ₹100 free credits on signup 🎁</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

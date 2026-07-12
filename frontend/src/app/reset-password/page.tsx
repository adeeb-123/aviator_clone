'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  const submit = async () => {
    setErr('');
    if (password.length < 8) return setErr('Password must be at least 8 characters');
    if (password !== confirm) return setErr('Passwords do not match');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-4 text-2xl font-black">Set a new password</h1>
        <div className="glass space-y-3 p-6">
          {done ? (
            <div className="space-y-4 text-center">
              <div className="text-4xl">✅</div>
              <p className="text-white/80">Your password has been updated and all sessions were signed out.</p>
              <Link href="/" className="btn-primary inline-block">Go to login</Link>
            </div>
          ) : !token ? (
            <p className="text-loss">This reset link is missing its token. Please request a new one from the login screen.</p>
          ) : (
            <>
              <input
                className="input"
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
              />
              {err && (
                <div className="flex items-start gap-2 rounded-lg border border-loss/40 bg-loss/15 px-3 py-2 text-sm text-loss">
                  <span className="shrink-0">⚠️</span><span>{err}</span>
                </div>
              )}
              <button className="btn-primary w-full" onClick={() => void submit()} disabled={busy}>
                {busy ? 'Updating…' : 'Update password'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';

const errText = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Something went wrong';

export default function TwoFactorSettings() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const enabled = !!user?.twoFactorEnabled;

  const [step, setStep] = useState<'idle' | 'setup'>('idle');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const startSetup = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setSecret(data.secret); setOtpauth(data.otpauth); setStep('setup');
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  const confirmEnable = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.post('/auth/2fa/enable', { code });
      if (user) setUser({ ...user, twoFactorEnabled: true });
      setStep('idle'); setCode('');
      setMsg(
        user?.role === 'admin'
          ? 'Two-factor enabled. Log out and log back in with a code — this is required to access the admin panel.'
          : 'Two-factor enabled. Log out and log back in to refresh your session.',
      );
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      await api.post('/auth/2fa/disable', { password: pwd, code });
      if (user) setUser({ ...user, twoFactorEnabled: false });
      setPwd(''); setCode('');
      setMsg('Two-factor authentication disabled.');
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="glass space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Two-factor authentication</h2>
          <p className="text-xs text-white/40">Protect your account with an authenticator app (Google Authenticator, Authy…).</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${enabled ? 'bg-win/20 text-win' : 'bg-base-700 text-white/50'}`}>
          {enabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {msg && <div className="rounded-lg border border-win/40 bg-win/10 px-3 py-2 text-sm text-win">{msg}</div>}
      {err && <div className="rounded-lg border border-loss/40 bg-loss/15 px-3 py-2 text-sm text-loss">⚠️ {err}</div>}

      {/* Not enabled → enroll */}
      {!enabled && step === 'idle' && (
        <button className="btn-primary" onClick={() => void startSetup()} disabled={busy}>
          {busy ? 'Please wait…' : 'Enable 2FA'}
        </button>
      )}

      {!enabled && step === 'setup' && (
        <div className="space-y-3">
          <p className="text-sm text-white/70">
            1. Add this account to your authenticator app. Scan the link on mobile, or enter the secret key manually:
          </p>
          <div className="rounded-lg bg-base-800 p-3">
            <div className="mb-1 text-[11px] uppercase tracking-widest text-white/40">Secret key</div>
            <code className="break-all text-sm text-accent-glow">{secret}</code>
          </div>
          <a href={otpauth} className="inline-block text-xs text-accent-glow hover:underline">Open in authenticator app (mobile)</a>
          <p className="text-sm text-white/70">2. Enter the 6-digit code it shows:</p>
          <input
            className="input tracking-[0.4em]"
            placeholder="123456"
            inputMode="numeric"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => void confirmEnable()} disabled={busy || code.length < 6}>
              {busy ? 'Verifying…' : 'Verify & enable'}
            </button>
            <button className="rounded-lg bg-base-700 px-4 text-sm hover:bg-base-600" onClick={() => { setStep('idle'); setErr(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Enabled → disable (requires password + current code) */}
      {enabled && (
        <div className="space-y-2">
          <input className="input" type="password" placeholder="Your password" autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          <input
            className="input tracking-[0.4em]"
            placeholder="Current 2FA code"
            inputMode="numeric"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button className="rounded-lg border border-loss/40 bg-loss/10 px-4 py-2 text-sm font-semibold text-loss hover:bg-loss/20" onClick={() => void disable()} disabled={busy || !pwd || code.length < 6}>
            {busy ? 'Please wait…' : 'Disable 2FA'}
          </button>
          {user?.role === 'admin' && (
            <p className="text-[11px] text-white/40">Admin accounts are required to keep 2FA enabled.</p>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const [state, setState] = useState<'verifying' | 'ok' | 'fail'>('verifying');
  const [msg, setMsg] = useState('Verifying your email…');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('fail');
      setMsg('This verification link is missing its token.');
      return;
    }
    api
      .get('/auth/verify-email', { params: { token } })
      .then((r) => { setState('ok'); setMsg(r.data?.message ?? 'Your email is verified!'); })
      .catch((e) => { setState('fail'); setMsg(e?.response?.data?.error ?? 'Verification failed or the link has expired.'); });
  }, []);

  const icon = state === 'verifying' ? '⏳' : state === 'ok' ? '✅' : '⚠️';

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="glass space-y-4 p-8">
          <div className="text-5xl">{icon}</div>
          <p className="text-white/80">{msg}</p>
          {state !== 'verifying' && <Link href="/" className="btn-primary inline-block">Continue</Link>}
        </div>
      </main>
    </div>
  );
}

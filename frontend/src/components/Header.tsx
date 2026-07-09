'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/store';
import { sound } from '@/lib/sound';
import { useT } from '@/lib/i18n';
import { inr } from '@/lib/format';
import AuthModal from './AuthModal';

export default function Header() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { t, lang, setLang } = useT();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => { setMuted(sound.isMuted()); return sound.subscribe(setMuted); }, []);

  // If we were redirected here after an auth failure, open the login modal.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('auth') === 'required') {
      setAuthOpen(true);
      const url = new URL(window.location.href); url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

  const navLinks = (
    <>
      <Link href="/" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.play')}</Link>
      {user && <Link href="/dashboard" className="hover:text-white" onClick={() => setMenuOpen(false)}>📊 Dashboard</Link>}
      {user && <Link href="/rewards" data-tour="rewards" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.rewards')}</Link>}
      {user && <Link href="/tournaments" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.tournaments')}</Link>}
      {user && <Link href="/stats" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.stats')}</Link>}
      {user && <Link href="/history" className="hover:text-white xl:hidden" onClick={() => setMenuOpen(false)}>{t('nav.history')}</Link>}
      {user && <Link href="/profile" className="hover:text-white xl:hidden" onClick={() => setMenuOpen(false)}>{t('nav.profile')}</Link>}
      <Link href="/fairness" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.fairness')}</Link>
      <Link href="/rtp" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.rtp')}</Link>
      {user?.role === 'admin' && <Link href="/admin" className="text-gold hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.admin')}</Link>}
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-base-900/70 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-lg font-black sm:text-xl">
          <span className="text-xl sm:text-2xl">✈️</span>
          <span className="hidden bg-gradient-to-r from-accent-glow to-win bg-clip-text text-transparent sm:inline">AVIATOR</span>
        </Link>

        {/* desktop nav (only when there's real room) */}
        <nav className="hidden min-w-0 items-center gap-4 overflow-hidden text-sm text-white/60 xl:flex">{navLinks}</nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {user && (
            <div className="glass max-w-[46vw] truncate px-2.5 py-1.5 text-sm sm:max-w-none">
              <span className="hidden text-white/40 sm:inline">{t('common.balance')} </span>
              <span className="font-bold text-win">{inr(user.balance)}</span>
            </div>
          )}
          <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} title="Language" className="rounded-lg bg-base-700 px-2 py-1.5 text-xs font-bold text-white/70 hover:text-white">
            {lang === 'en' ? 'EN' : 'हिं'}
          </button>
          <button onClick={() => sound.toggle()} aria-label={muted ? 'Unmute' : 'Mute'} className="rounded-lg bg-base-700 px-2.5 py-1.5 text-sm text-white/70 hover:text-white">
            {muted ? '🔇' : '🔊'}
          </button>

          {/* desktop auth cluster */}
          <div className="hidden items-center gap-2 xl:flex">
            {user ? (
              <>
                <Link href="/wallet" className="btn-primary text-sm">{t('nav.wallet')}</Link>
                <button className="btn bg-base-700 text-sm text-white/70" onClick={() => void logout()}>{t('nav.logout')}</button>
              </>
            ) : (
              <button className="btn-primary" onClick={() => setAuthOpen(true)}>{t('nav.login')}</button>
            )}
          </div>

          {/* menu button (everything below xl) */}
          <button className="rounded-lg bg-base-700 px-2.5 py-1.5 text-lg leading-none text-white/80 xl:hidden" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* dropdown menu (below xl) */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-base-900/95 px-4 py-3 xl:hidden">
          <nav className="flex flex-col gap-3 text-sm text-white/70">{navLinks}</nav>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {user ? (
              <>
                <Link href="/wallet" className="btn-primary flex-1 text-center text-sm" onClick={() => setMenuOpen(false)}>{t('nav.wallet')}</Link>
                <button className="btn flex-1 bg-base-700 text-sm text-white/70" onClick={() => { setMenuOpen(false); void logout(); }}>{t('nav.logout')} {user.username && `· ${user.username}`}</button>
                <button className="btn w-full bg-base-700 text-xs text-white/60" onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('start-tour')); }}>🎓 Replay tour</button>
              </>
            ) : (
              <button className="btn-primary w-full" onClick={() => { setMenuOpen(false); setAuthOpen(true); }}>{t('nav.login')}</button>
            )}
          </div>
        </div>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

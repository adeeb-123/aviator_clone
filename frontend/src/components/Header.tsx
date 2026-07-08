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

  const navLinks = (
    <>
      <Link href="/" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.play')}</Link>
      {user && <Link href="/rewards" data-tour="rewards" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.rewards')}</Link>}
      {user && <Link href="/tournaments" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.tournaments')}</Link>}
      {user && <Link href="/stats" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.stats')}</Link>}
      {user && <Link href="/history" className="hover:text-white md:hidden" onClick={() => setMenuOpen(false)}>{t('nav.history')}</Link>}
      {user && <Link href="/profile" className="hover:text-white md:hidden" onClick={() => setMenuOpen(false)}>{t('nav.profile')}</Link>}
      <Link href="/fairness" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.fairness')}</Link>
      <Link href="/rtp" className="hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.rtp')}</Link>
      {user?.role === 'admin' && <Link href="/admin" className="text-gold hover:text-white" onClick={() => setMenuOpen(false)}>{t('nav.admin')}</Link>}
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-base-900/70 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <Link href="/" className="flex items-center gap-1.5 text-lg font-black sm:text-xl">
          <span className="text-xl sm:text-2xl">✈️</span>
          <span className="bg-gradient-to-r from-accent-glow to-win bg-clip-text text-transparent">AVIATOR</span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-6 text-sm text-white/60 md:flex">{navLinks}</nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <div className="glass px-2.5 py-1.5 text-sm">
              <span className="hidden text-white/40 sm:inline">{t('common.balance')} </span>
              <span className="font-bold text-win">{inr(user.balance)}</span>
            </div>
          )}
          <button onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('start-tour')); }} title="Take the tour" className="hidden rounded-lg bg-base-700 px-2.5 py-1.5 text-sm text-white/70 hover:text-white sm:block">
            ?
          </button>
          <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} title="Language" className="rounded-lg bg-base-700 px-2 py-1.5 text-xs font-bold text-white/70 hover:text-white">
            {lang === 'en' ? 'EN' : 'हिं'}
          </button>
          <button onClick={() => sound.toggle()} aria-label={muted ? 'Unmute' : 'Mute'} className="rounded-lg bg-base-700 px-2.5 py-1.5 text-sm text-white/70 hover:text-white">
            {muted ? '🔇' : '🔊'}
          </button>

          {/* desktop auth cluster */}
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                <Link href="/wallet" className="btn-primary text-sm">{t('nav.wallet')}</Link>
                <Link href="/profile" className="hidden text-sm text-white/70 hover:text-white lg:block">{user.avatar ?? '👤'} {user.username}</Link>
                <button className="btn bg-base-700 text-sm text-white/70" onClick={() => void logout()}>{t('nav.logout')}</button>
              </>
            ) : (
              <button className="btn-primary" onClick={() => setAuthOpen(true)}>{t('nav.login')}</button>
            )}
          </div>

          {/* mobile menu button */}
          <button className="rounded-lg bg-base-700 px-2.5 py-1.5 text-lg leading-none text-white/80 md:hidden" aria-label="Menu" onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-base-900/95 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-3 text-sm text-white/70">{navLinks}</nav>
          <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
            {user ? (
              <>
                <Link href="/wallet" className="btn-primary flex-1 text-center text-sm" onClick={() => setMenuOpen(false)}>Wallet</Link>
                <button className="btn flex-1 bg-base-700 text-sm text-white/70" onClick={() => { setMenuOpen(false); void logout(); }}>Logout {user.username && `(${user.username})`}</button>
              </>
            ) : (
              <button className="btn-primary w-full" onClick={() => { setMenuOpen(false); setAuthOpen(true); }}>Login / Register</button>
            )}
          </div>
        </div>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/store';
import AuthModal from './AuthModal';

export default function Header() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-base-900/70 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-black">
          <span className="text-2xl">✈️</span>
          <span className="bg-gradient-to-r from-accent-glow to-win bg-clip-text text-transparent">AVIATOR</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-white/60 md:flex">
          <Link href="/" className="hover:text-white">
            Play
          </Link>
          <Link href="/fairness" className="hover:text-white">
            Provably Fair
          </Link>
          {user?.role === 'admin' && (
            <Link href="/admin" className="text-gold hover:text-white">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="glass px-3 py-1.5 text-sm">
                <span className="text-white/40">Balance </span>
                <span className="font-bold text-win">₹{user.balance.toFixed(2)}</span>
              </div>
              <Link href="/wallet" className="btn-primary text-sm">
                Wallet
              </Link>
              <div className="hidden text-sm text-white/70 sm:block">{user.username}</div>
              <button className="btn bg-base-700 text-sm text-white/70" onClick={() => void logout()}>
                Logout
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={() => setAuthOpen(true)}>
              Login / Register
            </button>
          )}
        </div>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  );
}

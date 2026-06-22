'use client';

import Header from '@/components/Header';
import GameCanvas from '@/components/GameCanvas';
import MultiplierDisplay from '@/components/MultiplierDisplay';
import BetPanel from '@/components/BetPanel';
import RoundHistory from '@/components/RoundHistory';
import PlayerList from '@/components/PlayerList';
import Chat from '@/components/Chat';
import Leaderboard from '@/components/Leaderboard';
import { useGame } from '@/lib/store';

export default function GamePage() {
  const phase = useGame((s) => s.phase);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_320px]">
        {/* left column: game — min-w-0 lets the 1fr column shrink so the long
            round-history row scrolls internally instead of overflowing the page */}
        <section className="min-w-0 space-y-4">
          <div className="glass min-w-0 p-3">
            <RoundHistory />
          </div>

          <div
            className={`relative h-[360px] overflow-hidden rounded-2xl border border-white/5 md:h-[460px] ${
              phase === 'crashed' ? 'ring-2 ring-loss/40' : ''
            }`}
            style={{ background: 'radial-gradient(circle at 30% 100%, rgba(124,58,237,0.15), transparent 60%)' }}
          >
            <GameCanvas />
            <MultiplierDisplay />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BetPanel slot={1} />
            <BetPanel slot={2} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-72">
              <PlayerList />
            </div>
            <Leaderboard />
          </div>
        </section>

        {/* right column: chat */}
        <aside className="h-[calc(100vh-7rem)] min-w-0 lg:sticky lg:top-20">
          <Chat />
        </aside>
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-white/30">
        Aviator Clone · Educational demo · Provably fair · Play responsibly
      </footer>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { getSocket, EVENTS } from '@/lib/socket';
import { useAuth, useGame } from '@/lib/store';
import { sound } from '@/lib/sound';

/**
 * Connects the socket once on mount and pipes all game events into the
 * Zustand stores so every component just reads reactive state.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuth((s) => s.hydrate);
  const setBalance = useAuth((s) => s.setBalance);
  const gset = useGame((s) => s.set);
  const addChat = useGame((s) => s.addChat);
  const removeChat = useGame((s) => s.removeChat);
  const setReactions = useGame((s) => s.setReactions);

  useEffect(() => {
    void hydrate();
    const socket = getSocket();

    socket.on(EVENTS.STATE_INIT, (snap) => {
      gset({
        phase: snap.phase,
        roundId: snap.roundId,
        multiplier: snap.multiplier,
        serverSeedHash: snap.serverSeedHash,
        clientSeed: snap.clientSeed,
        players: snap.players ?? [],
        jackpot: snap.jackpot ?? 0,
        jackpotEnabled: snap.jackpotEnabled ?? false,
        jackpotTrigger: snap.jackpotTrigger ?? 25,
        sideBetsEnabled: snap.sideBetsEnabled ?? false,
        sideBetMarkets: snap.sideBetMarkets ?? [],
      });
    });

    socket.on(EVENTS.ROUND_BETTING, (p) => {
      gset({
        phase: 'betting',
        roundId: p.roundId,
        multiplier: 1,
        crashPoint: null,
        serverSeedHash: p.serverSeedHash,
        clientSeed: p.clientSeed,
        bettingEndsAt: p.bettingEndsAt,
        players: [],
        ...(typeof p.jackpot === 'number' ? { jackpot: p.jackpot } : {}),
        jackpotEnabled: p.jackpotEnabled ?? false,
        jackpotTrigger: p.jackpotTrigger ?? 25,
        sideBetsEnabled: p.sideBetsEnabled ?? false,
        sideBetMarkets: p.sideBetMarkets ?? [],
      });
    });

    socket.on(EVENTS.ROUND_RUNNING, () => gset({ phase: 'running' }));
    socket.on(EVENTS.ROUND_TICK, (p) => gset({ multiplier: p.multiplier }));
    socket.on(EVENTS.ROUND_CRASHED, (p) => {
      gset({ phase: 'crashed', crashPoint: p.crashPoint, multiplier: p.crashPoint });
      sound.crash();
    });
    socket.on(EVENTS.ROUND_HISTORY, (h) => gset({ history: h }));
    socket.on(EVENTS.PLAYERS_UPDATE, (players) => gset({ players }));
    socket.on(EVENTS.BALANCE_UPDATE, (p) => setBalance(p.balance));
    socket.on(EVENTS.CHAT_MESSAGE, (m) => addChat(m));
    socket.on('chat:delete', (p: { id: string }) => removeChat(p.id));
    socket.on('chat:reaction', (p: { id: string; reactions: Record<string, number> }) => setReactions(p.id, p.reactions));
    socket.on('jackpot:update', (p: { pot: number }) => gset({ jackpot: p.pot }));
    socket.on('jackpot:won', (p: { username: string; amount: number; multiplier: number; pot: number }) => {
      gset({ jackpot: p.pot });
      sound.reward();
      window.dispatchEvent(new CustomEvent('jackpot-won', { detail: p }));
    });

    return () => {
      socket.off(EVENTS.STATE_INIT);
      socket.off(EVENTS.ROUND_BETTING);
      socket.off(EVENTS.ROUND_RUNNING);
      socket.off(EVENTS.ROUND_TICK);
      socket.off(EVENTS.ROUND_CRASHED);
      socket.off(EVENTS.ROUND_HISTORY);
      socket.off(EVENTS.PLAYERS_UPDATE);
      socket.off(EVENTS.BALANCE_UPDATE);
      socket.off(EVENTS.CHAT_MESSAGE);
      socket.off('chat:delete');
      socket.off('chat:reaction');
      socket.off('jackpot:update');
      socket.off('jackpot:won');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

import { Server } from 'socket.io';
import { Round } from '../models/Round';
import { Bet } from '../models/Bet';
import { User } from '../models/User';
import { adjustBalance } from './ledger';
import { getActiveSeed, nextNonce } from './seedManager';
import { computeCrashPoint, generateClientSeed } from '../utils/provablyFair';
import { getLeaderboard } from './leaderboard';
import { alertLargeBet, alertBigWin } from './alertService';
import { cfg } from './runtimeConfig';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { EVENTS, PublicBet } from '../socket/events';

type Phase = 'idle' | 'betting' | 'running' | 'crashed';

interface LiveBet {
  betId: string;
  userId: string;
  username: string;
  slot: 1 | 2;
  amount: number;
  autoCashout?: number;
  cashoutMultiplier?: number;
  payout: number;
  status: 'pending' | 'cashed-out' | 'lost';
}

/**
 * Authoritative server-side game loop. A single instance per process drives
 * round lifecycle and broadcasts to all sockets. State is in-memory for speed;
 * the database is the durable record of rounds, bets and balances.
 */
export class GameEngine {
  private io: Server;
  private phase: Phase = 'idle';
  private roundId = 0;
  private crashPoint = 1;
  private startTime = 0;
  private serverSeedHash = '';
  private clientSeed = '';
  private nonce = 0;
  private liveBets = new Map<string, LiveBet>(); // key: `${userId}:${slot}`
  private tickTimer?: NodeJS.Timeout;
  private phaseTimer?: NodeJS.Timeout;
  private running = false;

  /** Admin override: FIFO queue of forced crash points, applied to successive rounds. */
  private forcedCrashQueue: number[] = [];
  /** The forced crash point applied to the CURRENT round (null = provably-fair). */
  private activeForcedCrash: number | null = null;
  private paused = false;

  // exponential growth rate (per second). Tuned for a lively but fair curve.
  private static GROWTH_RATE = 0.09;

  constructor(io: Server) {
    this.io = io;
  }

  /** Broadcast an arbitrary event to all sockets (used by admin moderation/broadcast). */
  emit(event: string, payload: unknown): void {
    this.io.emit(event, payload);
  }

  // ── public state accessors ───────────────────────────────
  getPhase(): Phase {
    return this.phase;
  }

  getMultiplierNow(): number {
    if (this.phase !== 'running') return 1;
    return this.computeMultiplier(Date.now() - this.startTime);
  }

  getSnapshot() {
    return {
      phase: this.phase,
      roundId: this.roundId,
      multiplier: this.getMultiplierNow(),
      serverSeedHash: this.serverSeedHash,
      clientSeed: this.clientSeed,
      players: this.publicBets(),
    };
  }

  /**
   * Admin-only status. Includes the pause flag and any queued force-crash —
   * these must NEVER be exposed on the public snapshot (would leak the next
   * crash point to players).
   */
  getAdminStatus() {
    const all = [...this.liveBets.values()];
    const pending = all.filter((b) => b.status === 'pending');
    const m = this.getMultiplierNow();
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      phase: this.phase,
      roundId: this.roundId,
      multiplier: m,
      paused: this.paused,
      activeForcedCrash: this.activeForcedCrash,
      forcedCrashQueue: [...this.forcedCrashQueue],
      running: this.running,
      // live risk for THIS round
      roundBets: all.length,
      roundWagered: round2(all.reduce((s, b) => s + b.amount, 0)),
      liveExposure: round2(pending.reduce((s, b) => s + b.amount * m, 0)), // payout if all open bets cashed now
    };
  }

  /** Clear the entire force-crash queue. */
  clearForcedCrash(): void {
    this.forcedCrashQueue = [];
  }

  /** Remove a single queued force-crash by its position (0-based). */
  removeForcedCrashAt(index: number): void {
    if (index >= 0 && index < this.forcedCrashQueue.length) {
      this.forcedCrashQueue.splice(index, 1);
    }
  }

  /** Replace the queue (used by drag-to-reorder in the admin panel). */
  setForcedCrashQueue(values: number[]): void {
    this.forcedCrashQueue = (values ?? []).filter((v) => typeof v === 'number' && Number.isFinite(v) && v >= 1).map((v) => Math.max(1, v));
  }

  // ── lifecycle control ────────────────────────────────────
  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('GameEngine started');
    void this.beginBetting();
  }

  stop(): void {
    this.running = false;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    logger.info('GameEngine stopped');
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Append a forced crash point to the queue (applied FIFO to upcoming rounds). */
  forceCrashPoint(value: number): void {
    this.forcedCrashQueue.push(Math.max(1, value));
    logger.warn({ value, queued: this.forcedCrashQueue.length }, 'Admin queued a forced crash point');
  }

  // ── round phases ─────────────────────────────────────────
  private async beginBetting(): Promise<void> {
    if (!this.running) return;
    if (this.paused) {
      this.phaseTimer = setTimeout(() => void this.beginBetting(), 2000);
      return;
    }

    try {
      const seed = await getActiveSeed();
      this.nonce = await nextNonce(seed._id);
      this.clientSeed = generateClientSeed();
      this.serverSeedHash = seed.hash;
      // Consume the next queued forced crash (FIFO), else compute provably-fair.
      const forced = this.forcedCrashQueue.shift();
      this.crashPoint = forced ?? computeCrashPoint(seed.seed, this.clientSeed, this.nonce);
      this.activeForcedCrash = forced ?? null; // what's being applied to THIS round

      const last = await Round.findOne().sort({ roundId: -1 }).select('roundId').lean();
      this.roundId = (last?.roundId ?? 0) + 1;

      await Round.create({
        roundId: this.roundId,
        nonce: this.nonce,
        crashPoint: this.crashPoint,
        serverSeedHash: this.serverSeedHash,
        serverSeedId: seed._id,
        clientSeed: this.clientSeed,
        status: 'betting',
      });

      this.liveBets.clear();
      this.phase = 'betting';

      const bettingWindowMs = cfg().bettingWindowMs;
      const bettingEndsAt = Date.now() + bettingWindowMs;
      this.io.emit(EVENTS.ROUND_BETTING, {
        roundId: this.roundId,
        serverSeedHash: this.serverSeedHash,
        clientSeed: this.clientSeed,
        nonce: this.nonce,
        bettingEndsAt,
      });
      logger.debug({ roundId: this.roundId, crashPoint: this.crashPoint }, 'Betting open');

      this.phaseTimer = setTimeout(() => void this.beginRunning(), bettingWindowMs);
    } catch (err) {
      logger.error({ err }, 'beginBetting failed; retrying');
      this.phaseTimer = setTimeout(() => void this.beginBetting(), 3000);
    }
  }

  private async beginRunning(): Promise<void> {
    if (!this.running) return;
    this.phase = 'running';
    this.startTime = Date.now();
    await Round.updateOne({ roundId: this.roundId }, { status: 'running', startTime: new Date() });

    this.io.emit(EVENTS.ROUND_RUNNING, { roundId: this.roundId });

    this.tickTimer = setInterval(() => this.tick(), env.game.tickMs);
  }

  private tick(): void {
    const elapsed = Date.now() - this.startTime;
    const multiplier = this.computeMultiplier(elapsed);

    if (multiplier >= this.crashPoint) {
      // Fairness: if a tick jumps past both an auto-cashout target AND the crash
      // point, honour auto-cashouts whose target was below the crash (they would
      // have triggered first) at their target, then crash.
      for (const bet of this.liveBets.values()) {
        if (bet.status === 'pending' && bet.autoCashout && bet.autoCashout < this.crashPoint) {
          void this.settleCashout(bet, bet.autoCashout, true);
        }
      }
      void this.crash();
      return;
    }

    // auto-cashout sweep
    for (const bet of this.liveBets.values()) {
      if (bet.status === 'pending' && bet.autoCashout && multiplier >= bet.autoCashout) {
        void this.settleCashout(bet, bet.autoCashout, true);
      }
    }

    this.io.emit(EVENTS.ROUND_TICK, { roundId: this.roundId, multiplier, elapsed });
  }

  private async crash(): Promise<void> {
    if (this.phase !== 'running') return; // idempotent — may be triggered by a tick or a late cashout
    this.phase = 'crashed';
    if (this.tickTimer) clearInterval(this.tickTimer);

    // Any still-pending bet loses.
    const losers: Promise<unknown>[] = [];
    for (const bet of this.liveBets.values()) {
      if (bet.status === 'pending') {
        bet.status = 'lost';
        losers.push(
          Bet.updateOne({ _id: bet.betId }, { status: 'lost', payout: 0 }).exec(),
        );
      }
    }
    await Promise.all(losers);

    const totalWagered = [...this.liveBets.values()].reduce((s, b) => s + b.amount, 0);
    const totalPayout = [...this.liveBets.values()].reduce((s, b) => s + b.payout, 0);

    await Round.updateOne(
      { roundId: this.roundId },
      {
        status: 'crashed',
        endTime: new Date(),
        totalBets: this.liveBets.size,
        totalWagered,
        totalPayout,
      },
    );

    this.io.emit(EVENTS.ROUND_CRASHED, {
      roundId: this.roundId,
      crashPoint: this.crashPoint,
      serverSeedHash: this.serverSeedHash,
    });

    await this.broadcastHistory();
    await this.broadcastLeaderboard();

    logger.debug({ roundId: this.roundId, crashPoint: this.crashPoint }, 'Round crashed');

    this.phaseTimer = setTimeout(() => void this.beginBetting(), cfg().roundPauseMs);
  }

  // ── player actions (called from socket handlers) ─────────
  async placeBet(params: {
    userId: string;
    username: string;
    slot: 1 | 2;
    amount: number;
    autoCashout?: number;
  }): Promise<{ balance: number; bet: PublicBet }> {
    if (this.phase !== 'betting') throw new Error('Betting is closed for this round');

    // Validate ALL inputs up front, before any balance is debited. Previously a
    // bad autoCashout (or a non-finite amount) was caught only at Bet.create —
    // after the stake had already been deducted — losing the user's money.
    const { amount, autoCashout } = params;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error('Invalid bet amount');
    }
    if (amount < cfg().minBet || amount > cfg().maxBet) {
      throw new Error(`Bet must be between ${cfg().minBet} and ${cfg().maxBet}`);
    }
    if (autoCashout !== undefined) {
      if (typeof autoCashout !== 'number' || !Number.isFinite(autoCashout) || autoCashout < 1.01) {
        throw new Error('Auto-cashout must be at least 1.01x');
      }
    }
    const key = `${params.userId}:${params.slot}`;
    if (this.liveBets.has(key)) throw new Error('You already placed a bet on this slot');

    // Reserve the slot SYNCHRONOUSLY before any await. JS is single-threaded, so a
    // concurrent duplicate request (double-click / two tabs) now sees this entry
    // and is rejected — preventing the TOCTOU double-debit + orphaned bet.
    const live: LiveBet = {
      betId: '',
      userId: params.userId,
      username: params.username,
      slot: params.slot,
      amount,
      autoCashout,
      payout: 0,
      status: 'pending',
    };
    this.liveBets.set(key, live);

    let balance: number;
    try {
      balance = await adjustBalance({
        userId: params.userId,
        amount: -amount,
        type: 'bet',
        description: `Bet on round ${this.roundId}`,
        reference: String(this.roundId),
      });
    } catch (err) {
      this.liveBets.delete(key); // release reservation on debit failure (e.g. insufficient funds)
      throw err;
    }

    // If bet creation fails for any reason, refund the stake and release the slot.
    let betDoc;
    try {
      betDoc = await Bet.create({
        userId: params.userId,
        username: params.username,
        roundId: this.roundId,
        slot: params.slot,
        amount,
        autoCashout,
        isAutoCashout: Boolean(autoCashout),
        status: 'pending',
      });
    } catch (err) {
      await adjustBalance({
        userId: params.userId,
        amount,
        type: 'refund',
        description: `Refund — failed bet on round ${this.roundId}`,
        reference: String(this.roundId),
      });
      this.liveBets.delete(key);
      throw new Error('Could not place bet — your stake was refunded');
    }

    live.betId = String(betDoc._id);

    const publicBet: PublicBet = {
      username: live.username,
      amount: live.amount,
      slot: live.slot,
      autoCashout: live.autoCashout,
      status: 'pending',
    };
    this.io.emit(EVENTS.BET_PLACED, publicBet);
    this.io.emit(EVENTS.PLAYERS_UPDATE, this.publicBets());

    alertLargeBet({ userId: params.userId, username: params.username, amount, roundId: this.roundId });

    return { balance, bet: publicBet };
  }

  async cashout(userId: string, slot: 1 | 2): Promise<{ payout: number; multiplier: number; balance: number }> {
    if (this.phase !== 'running') throw new Error('Cannot cash out right now');
    const key = `${userId}:${slot}`;
    const bet = this.liveBets.get(key);
    if (!bet || bet.status !== 'pending') throw new Error('No active bet to cash out');

    const multiplier = this.getMultiplierNow();
    // SECURITY: the crash is only detected on 100ms ticks, but this multiplier is
    // real-time. If it has already reached the crash point, the round has crashed —
    // reject so a player can NEVER cash out at or above the crash point. Trigger the
    // crash immediately so the window closes for everyone.
    if (multiplier >= this.crashPoint) {
      void this.crash();
      throw new Error('Round has crashed');
    }
    const balance = await this.settleCashout(bet, multiplier, false);
    return { payout: bet.payout, multiplier, balance };
  }

  private async settleCashout(bet: LiveBet, multiplier: number, isAuto: boolean): Promise<number> {
    bet.status = 'cashed-out';
    bet.cashoutMultiplier = multiplier;
    bet.payout = Math.floor(bet.amount * multiplier * 100) / 100;

    const balance = await adjustBalance({
      userId: bet.userId,
      amount: bet.payout,
      type: 'win',
      description: `Cashout @${multiplier}x round ${this.roundId}`,
      reference: String(this.roundId),
    });

    await Bet.updateOne(
      { _id: bet.betId },
      { status: 'cashed-out', cashoutMultiplier: multiplier, payout: bet.payout, isAutoCashout: isAuto },
    );

    this.io.emit(EVENTS.BET_CASHOUT, {
      username: bet.username,
      slot: bet.slot,
      cashoutMultiplier: multiplier,
      payout: bet.payout,
    });
    this.io.to(`user:${bet.userId}`).emit(EVENTS.BALANCE_UPDATE, { balance });
    this.io.emit(EVENTS.PLAYERS_UPDATE, this.publicBets());

    alertBigWin({ userId: bet.userId, username: bet.username, amount: bet.amount, multiplier, payout: bet.payout, roundId: this.roundId });

    return balance;
  }

  // ── helpers ──────────────────────────────────────────────
  private computeMultiplier(elapsedMs: number): number {
    const sec = elapsedMs / 1000;
    const m = Math.pow(Math.E, GameEngine.GROWTH_RATE * sec);
    return Math.max(1, Math.floor(m * 100) / 100);
  }

  private publicBets(): PublicBet[] {
    return [...this.liveBets.values()].map((b) => ({
      username: b.username,
      amount: b.amount,
      slot: b.slot,
      autoCashout: b.autoCashout,
      cashoutMultiplier: b.cashoutMultiplier,
      payout: b.payout,
      status: b.status,
    }));
  }

  private async broadcastHistory(): Promise<void> {
    const history = await Round.find({ status: 'crashed' })
      .sort({ roundId: -1 })
      .limit(30)
      .select('roundId crashPoint serverSeedHash')
      .lean();
    this.io.emit(EVENTS.ROUND_HISTORY, history);
  }

  private async broadcastLeaderboard(): Promise<void> {
    const board = await getLeaderboard('today', 10);
    this.io.emit(EVENTS.LEADERBOARD_UPDATE, board);
  }
}

let engine: GameEngine | null = null;
export function initGameEngine(io: Server): GameEngine {
  if (!engine) engine = new GameEngine(io);
  return engine;
}
export function getGameEngine(): GameEngine {
  if (!engine) throw new Error('GameEngine not initialised');
  return engine;
}

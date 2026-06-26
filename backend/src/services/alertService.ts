import { Server } from 'socket.io';
import { Alert, AlertType, AlertSeverity } from '../models/Alert';
import { User } from '../models/User';
import { logger } from '../utils/logger';

/**
 * Operator alerting. Thresholds are env-configurable with sensible defaults and
 * can be tuned at runtime from the admin panel. Alerts are persisted and pushed
 * in real time to connected admins (the `admins` socket room).
 */
export const alertThresholds = {
  largeBet: Number(process.env.ALERT_LARGE_BET ?? 500),
  bigWinMultiplier: Number(process.env.ALERT_BIG_WIN_X ?? 5),
  highBalance: Number(process.env.ALERT_HIGH_BALANCE ?? 10000),
  largeWithdrawal: Number(process.env.ALERT_LARGE_WITHDRAWAL ?? 5000),
  largeDeposit: Number(process.env.ALERT_LARGE_DEPOSIT ?? 10000),
  bigPayout: Number(process.env.ALERT_BIG_PAYOUT ?? 5000),
};

let io: Server | null = null;
export function initAlerts(server: Server): void {
  io = server;
}

interface CreateAlertInput {
  type: AlertType;
  severity: AlertSeverity;
  userId?: string;
  username?: string;
  message: string;
  meta?: Record<string, unknown>;
}

/** Persist an alert (enriched with the user's basic details) and push it to admins. */
async function createAlert(input: CreateAlertInput): Promise<void> {
  try {
    let email: string | undefined;
    let balance: number | undefined;
    if (input.userId) {
      const u = await User.findById(input.userId).select('email balance').lean();
      email = u?.email;
      balance = u?.balance;
    }
    const alert = await Alert.create({
      type: input.type,
      severity: input.severity,
      userId: input.userId,
      username: input.username,
      message: input.message,
      meta: { ...input.meta, email, balance },
    });
    io?.to('admins').emit('admin:alert', {
      id: String(alert._id),
      type: alert.type,
      severity: alert.severity,
      userId: input.userId,
      username: alert.username,
      message: alert.message,
      meta: alert.meta,
      read: false,
      createdAt: alert.createdAt,
    });
    logger.info({ type: input.type, user: input.username }, 'Admin alert raised');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'createAlert failed');
  }
}

// ── trigger helpers (fire-and-forget from the call sites) ────────────────────

export function alertLargeBet(p: { userId: string; username: string; amount: number; roundId: number }): void {
  if (p.amount < alertThresholds.largeBet) return;
  void createAlert({
    type: 'large-bet',
    severity: p.amount >= alertThresholds.largeBet * 4 ? 'critical' : 'warning',
    userId: p.userId,
    username: p.username,
    message: `${p.username} placed a large bet of ₹${p.amount.toFixed(2)} on round #${p.roundId}`,
    meta: { amount: p.amount, roundId: p.roundId },
  });
}

export function alertBigWin(p: { userId: string; username: string; amount: number; multiplier: number; payout: number; roundId: number }): void {
  const byMult = p.multiplier >= alertThresholds.bigWinMultiplier;
  const byPayout = p.payout >= alertThresholds.bigPayout;
  if (!byMult && !byPayout) return;
  void createAlert({
    type: byPayout && p.payout >= alertThresholds.bigPayout * 2 ? 'big-payout' : 'big-win',
    severity: p.payout >= alertThresholds.bigPayout * 2 ? 'critical' : 'warning',
    userId: p.userId,
    username: p.username,
    message: `${p.username} won ₹${p.payout.toFixed(2)} @ ${p.multiplier.toFixed(2)}x (bet ₹${p.amount.toFixed(2)}) on round #${p.roundId}`,
    meta: { amount: p.amount, multiplier: p.multiplier, payout: p.payout, roundId: p.roundId },
  });
}

/**
 * Balance/transaction alerts. `prevBalance`/`newBalance` let us alert on a
 * threshold being CROSSED (not every transaction above it).
 */
export function alertBalanceEvent(p: {
  userId: string;
  username?: string;
  type: string;
  amount: number;
  prevBalance: number;
  newBalance: number;
}): void {
  // high-balance crossing (any credit that takes them over the line)
  if (p.amount > 0 && p.prevBalance <= alertThresholds.highBalance && p.newBalance > alertThresholds.highBalance) {
    void createAlert({
      type: 'high-balance',
      severity: 'warning',
      userId: p.userId,
      username: p.username,
      message: `${p.username ?? 'A player'}'s wallet crossed ₹${alertThresholds.highBalance} (now ₹${p.newBalance.toFixed(2)})`,
      meta: { balance: p.newBalance },
    });
  }
  if (p.type === 'withdraw' && Math.abs(p.amount) >= alertThresholds.largeWithdrawal) {
    void createAlert({
      type: 'large-withdrawal',
      severity: 'critical',
      userId: p.userId,
      username: p.username,
      message: `${p.username ?? 'A player'} requested a large withdrawal of ₹${Math.abs(p.amount).toFixed(2)}`,
      meta: { amount: Math.abs(p.amount) },
    });
  }
  if (p.type === 'deposit' && p.amount >= alertThresholds.largeDeposit) {
    void createAlert({
      type: 'large-deposit',
      severity: 'warning',
      userId: p.userId,
      username: p.username,
      message: `${p.username ?? 'A player'} made a large deposit of ₹${p.amount.toFixed(2)}`,
      meta: { amount: p.amount },
    });
  }
}

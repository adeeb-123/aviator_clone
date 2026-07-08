import { Request, Response } from 'express';
import crypto from 'crypto';
import { CryptoTransaction } from '../models/CryptoTransaction';
import { adjustBalance } from '../services/ledger';
import { cfg } from '../services/runtimeConfig';
import { liveRate } from '../services/marketService';
import { getGameEngine } from '../services/gameEngine';
import { logAdmin } from '../services/adminAudit';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/error';
import { badRequest, notFound } from '../utils/errors';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round8 = (n: number) => Math.round((n + Number.EPSILON) * 1e8) / 1e8;

/** Deterministic demo deposit address for a user+coin (looks real; no chain behind it). */
function depositAddress(userId: string, coin: string): string {
  const h = crypto.createHash('sha256').update(`${userId}:${coin}`).digest('hex');
  if (coin === 'BTC') return 'bc1q' + h.slice(0, 38);
  if (coin === 'LTC') return 'ltc1q' + h.slice(0, 38);
  return '0x' + h.slice(0, 40); // ETH / USDT / EVM-style
}

const fakeTxHash = () => '0x' + crypto.randomBytes(32).toString('hex');
const findCoin = (symbol: string) => cfg().cryptoCoins.find((c) => c.symbol === symbol && c.enabled);

/** Confirm a pending deposit: credit ₹ and notify the player in real time. */
async function confirmDeposit(txId: string): Promise<void> {
  const tx = await CryptoTransaction.findById(txId);
  if (!tx || tx.type !== 'deposit' || tx.status !== 'pending') return;
  tx.status = 'confirmed';
  tx.txHash = fakeTxHash();
  await tx.save();
  const balance = await adjustBalance({ userId: tx.userId, amount: tx.inrAmount, type: 'deposit', description: `Crypto deposit ${tx.cryptoAmount} ${tx.coin}` });
  try {
    getGameEngine().emitToUser(String(tx.userId), 'balance:update', { balance });
    getGameEngine().emitToUser(String(tx.userId), 'crypto:confirmed', { id: String(tx._id), coin: tx.coin, inrAmount: tx.inrAmount, balance });
  } catch (err) { logger.warn({ err }, 'crypto confirm notify failed'); }
}

/** Startup sweep: confirm any deposits left pending past the delay (survives restarts). */
export async function sweepPendingDeposits(): Promise<void> {
  const cutoff = new Date(Date.now() - cfg().cryptoConfirmSeconds * 1000);
  const stuck = await CryptoTransaction.find({ type: 'deposit', status: 'pending', createdAt: { $lte: cutoff } }).select('_id').lean();
  for (const t of stuck) await confirmDeposit(String(t._id));
  if (stuck.length) logger.info({ count: stuck.length }, 'Swept pending crypto deposits');
}

/** GET /crypto/coins — live rates, fees, addresses and withdrawal limits. */
export const getCoins = asyncHandler(async (req: Request, res: Response) => {
  const coins = cfg().cryptoCoins.filter((c) => c.enabled).map((c) => ({
    symbol: c.symbol, name: c.name,
    rate: liveRate(c.rate, c.symbol), baseRate: c.rate, networkFee: c.networkFee,
    address: depositAddress(req.user!.sub, c.symbol),
  }));
  res.json({ enabled: cfg().cryptoEnabled, coins, withdrawMin: cfg().cryptoWithdrawMin, withdrawMax: cfg().cryptoWithdrawMax, confirmSeconds: cfg().cryptoConfirmSeconds });
});

/** POST /crypto/deposit — record a pending deposit; confirm + credit after a delay. */
export const deposit = asyncHandler(async (req: Request, res: Response) => {
  if (!cfg().cryptoEnabled) throw badRequest('Crypto is currently disabled');
  const coin = findCoin(String(req.body?.coin ?? ''));
  if (!coin) throw badRequest('Unsupported coin');
  const cryptoAmount = Number(req.body?.cryptoAmount);
  if (!Number.isFinite(cryptoAmount) || cryptoAmount <= 0) throw badRequest('Enter a valid amount');

  const rate = liveRate(coin.rate, coin.symbol);
  const inrAmount = round2(cryptoAmount * rate);
  if (inrAmount <= 0) throw badRequest('Amount too small');

  const tx = await CryptoTransaction.create({
    userId: req.user!.sub, username: req.user!.username, type: 'deposit', coin: coin.symbol,
    cryptoAmount: round8(cryptoAmount), inrAmount, rate, address: depositAddress(req.user!.sub, coin.symbol), status: 'pending',
  });

  const delayMs = Math.max(0, cfg().cryptoConfirmSeconds) * 1000;
  if (delayMs === 0) { await confirmDeposit(String(tx._id)); }
  else setTimeout(() => { confirmDeposit(String(tx._id)).catch((err) => logger.warn({ err }, 'deferred confirm failed')); }, delayMs);

  const fresh = await CryptoTransaction.findById(tx._id).lean();
  res.json({ tx: fresh, confirmSeconds: cfg().cryptoConfirmSeconds });
});

/** POST /crypto/withdraw — validate limits + fee, debit ₹, queue for admin approval. */
export const withdraw = asyncHandler(async (req: Request, res: Response) => {
  if (!cfg().cryptoEnabled) throw badRequest('Crypto is currently disabled');
  const coin = findCoin(String(req.body?.coin ?? ''));
  if (!coin) throw badRequest('Unsupported coin');
  const cryptoAmount = Number(req.body?.cryptoAmount);
  const address = String(req.body?.address ?? '').trim();
  if (!Number.isFinite(cryptoAmount) || cryptoAmount <= 0) throw badRequest('Enter a valid amount');
  if (address.length < 12 || address.length > 120) throw badRequest('Enter a valid wallet address');
  if (cryptoAmount <= coin.networkFee) throw badRequest(`Amount must exceed the network fee (${coin.networkFee} ${coin.symbol})`);

  const rate = liveRate(coin.rate, coin.symbol);
  const inrAmount = round2(cryptoAmount * rate);
  if (inrAmount < cfg().cryptoWithdrawMin) throw badRequest(`Minimum withdrawal is ₹${cfg().cryptoWithdrawMin.toLocaleString('en-IN')}`);
  if (inrAmount > cfg().cryptoWithdrawMax) throw badRequest(`Maximum withdrawal is ₹${cfg().cryptoWithdrawMax.toLocaleString('en-IN')}`);

  const netAmount = round8(cryptoAmount - coin.networkFee);
  // Debit immediately (atomic, insufficient-funds guarded); refunded if admin rejects.
  const balance = await adjustBalance({ userId: req.user!.sub, amount: -inrAmount, type: 'withdraw', description: `Crypto withdrawal ${cryptoAmount} ${coin.symbol}` });
  const tx = await CryptoTransaction.create({
    userId: req.user!.sub, username: req.user!.username, type: 'withdrawal', coin: coin.symbol,
    cryptoAmount: round8(cryptoAmount), inrAmount, rate, feeAmount: coin.networkFee, netAmount, address, status: 'pending',
  });
  res.json({ balance, tx });
});

/** GET /crypto/history — the caller's crypto deposits & withdrawals. */
export const history = asyncHandler(async (req: Request, res: Response) => {
  const txs = await CryptoTransaction.find({ userId: req.user!.sub }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ transactions: txs });
});

// ── admin: withdrawal approval queue ───────────────────────
export const adminListWithdrawals = asyncHandler(async (req: Request, res: Response) => {
  const status = (req.query.status as string) || 'pending';
  const txs = await CryptoTransaction.find({ type: 'withdrawal', status }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ withdrawals: txs });
});

function notify(userId: unknown, kind: 'success' | 'error' | 'info', title: string, message: string): void {
  try { getGameEngine().emitToUser(String(userId), 'user:notify', { id: crypto.randomUUID(), kind, title, message, createdAt: new Date() }); }
  catch (err) { logger.warn({ err }, 'notify emit failed'); }
}
const inrFmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const adminApprove = asyncHandler(async (req: Request, res: Response) => {
  const tx = await CryptoTransaction.findById(req.params.id);
  if (!tx || tx.type !== 'withdrawal') throw notFound('Withdrawal not found');
  if (tx.status !== 'pending') throw badRequest('Withdrawal already processed');
  tx.status = 'completed';
  tx.txHash = fakeTxHash();
  await tx.save();
  notify(tx.userId, 'success', 'Withdrawal approved ✅', `Your ${tx.cryptoAmount} ${tx.coin} withdrawal (${inrFmt(tx.inrAmount)}) has been sent. Tx: ${tx.txHash.slice(0, 14)}…`);
  logAdmin(req, 'crypto-withdraw-approve', `@${tx.username} ${tx.cryptoAmount} ${tx.coin}`, { inrAmount: tx.inrAmount });
  res.json({ tx });
});

export const adminReject = asyncHandler(async (req: Request, res: Response) => {
  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) throw badRequest('A rejection reason is required');
  const tx = await CryptoTransaction.findById(req.params.id);
  if (!tx || tx.type !== 'withdrawal') throw notFound('Withdrawal not found');
  if (tx.status !== 'pending') throw badRequest('Withdrawal already processed');
  const balance = await adjustBalance({ userId: tx.userId, amount: tx.inrAmount, type: 'refund', description: `Rejected crypto withdrawal ${tx.cryptoAmount} ${tx.coin}` });
  tx.status = 'rejected';
  tx.note = reason.slice(0, 200);
  await tx.save();
  try { getGameEngine().emitToUser(String(tx.userId), 'balance:update', { balance }); } catch { /* ignore */ }
  notify(tx.userId, 'error', 'Withdrawal rejected ❌', `Your ${tx.cryptoAmount} ${tx.coin} withdrawal was rejected: “${tx.note}”. ${inrFmt(tx.inrAmount)} has been refunded to your balance.`);
  logAdmin(req, 'crypto-withdraw-reject', `@${tx.username} ${tx.cryptoAmount} ${tx.coin}`, { refunded: tx.inrAmount, reason: tx.note });
  res.json({ tx });
});

import { Request, Response } from 'express';
import crypto from 'crypto';
import { CryptoTransaction } from '../models/CryptoTransaction';
import { adjustBalance } from '../services/ledger';
import { cfg } from '../services/runtimeConfig';
import { logAdmin } from '../services/adminAudit';
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

/** GET /crypto/coins — enabled coins, rates and the caller's deposit addresses. */
export const getCoins = asyncHandler(async (req: Request, res: Response) => {
  const coins = cfg().cryptoCoins
    .filter((c) => c.enabled)
    .map((c) => ({ symbol: c.symbol, name: c.name, rate: c.rate, address: depositAddress(req.user!.sub, c.symbol) }));
  res.json({ enabled: cfg().cryptoEnabled, coins });
});

/** POST /crypto/deposit — simulate a confirmed on-chain deposit; credit INR. */
export const deposit = asyncHandler(async (req: Request, res: Response) => {
  if (!cfg().cryptoEnabled) throw badRequest('Crypto is currently disabled');
  const coin = findCoin(String(req.body?.coin ?? ''));
  if (!coin) throw badRequest('Unsupported coin');
  const cryptoAmount = Number(req.body?.cryptoAmount);
  if (!Number.isFinite(cryptoAmount) || cryptoAmount <= 0) throw badRequest('Enter a valid amount');

  const inrAmount = round2(cryptoAmount * coin.rate);
  if (inrAmount <= 0) throw badRequest('Amount too small');

  const address = depositAddress(req.user!.sub, coin.symbol);
  const balance = await adjustBalance({ userId: req.user!.sub, amount: inrAmount, type: 'deposit', description: `Crypto deposit ${cryptoAmount} ${coin.symbol}` });
  const tx = await CryptoTransaction.create({
    userId: req.user!.sub, username: req.user!.username, type: 'deposit', coin: coin.symbol,
    cryptoAmount: round8(cryptoAmount), inrAmount, rate: coin.rate, address, txHash: fakeTxHash(), status: 'confirmed',
  });
  res.json({ balance, tx });
});

/** POST /crypto/withdraw — debit INR now; queue a pending withdrawal for admin approval. */
export const withdraw = asyncHandler(async (req: Request, res: Response) => {
  if (!cfg().cryptoEnabled) throw badRequest('Crypto is currently disabled');
  const coin = findCoin(String(req.body?.coin ?? ''));
  if (!coin) throw badRequest('Unsupported coin');
  const cryptoAmount = Number(req.body?.cryptoAmount);
  const address = String(req.body?.address ?? '').trim();
  if (!Number.isFinite(cryptoAmount) || cryptoAmount <= 0) throw badRequest('Enter a valid amount');
  if (address.length < 12 || address.length > 120) throw badRequest('Enter a valid wallet address');

  const inrAmount = round2(cryptoAmount * coin.rate);
  if (inrAmount <= 0) throw badRequest('Amount too small');

  // Debit immediately (atomic, insufficient-funds guarded); refunded if admin rejects.
  const balance = await adjustBalance({ userId: req.user!.sub, amount: -inrAmount, type: 'withdraw', description: `Crypto withdrawal ${cryptoAmount} ${coin.symbol}` });
  const tx = await CryptoTransaction.create({
    userId: req.user!.sub, username: req.user!.username, type: 'withdrawal', coin: coin.symbol,
    cryptoAmount: round8(cryptoAmount), inrAmount, rate: coin.rate, address, status: 'pending',
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

export const adminApprove = asyncHandler(async (req: Request, res: Response) => {
  const tx = await CryptoTransaction.findById(req.params.id);
  if (!tx || tx.type !== 'withdrawal') throw notFound('Withdrawal not found');
  if (tx.status !== 'pending') throw badRequest('Withdrawal already processed');
  tx.status = 'completed';
  tx.txHash = fakeTxHash();
  await tx.save();
  logAdmin(req, 'crypto-withdraw-approve', `@${tx.username} ${tx.cryptoAmount} ${tx.coin}`, { inrAmount: tx.inrAmount });
  res.json({ tx });
});

export const adminReject = asyncHandler(async (req: Request, res: Response) => {
  const tx = await CryptoTransaction.findById(req.params.id);
  if (!tx || tx.type !== 'withdrawal') throw notFound('Withdrawal not found');
  if (tx.status !== 'pending') throw badRequest('Withdrawal already processed');
  // Refund the debited INR back to the player.
  await adjustBalance({ userId: tx.userId, amount: tx.inrAmount, type: 'refund', description: `Rejected crypto withdrawal ${tx.cryptoAmount} ${tx.coin}` });
  tx.status = 'rejected';
  tx.note = String(req.body?.reason ?? 'Rejected by admin').slice(0, 200);
  await tx.save();
  logAdmin(req, 'crypto-withdraw-reject', `@${tx.username} ${tx.cryptoAmount} ${tx.coin}`, { refunded: tx.inrAmount });
  res.json({ tx });
});

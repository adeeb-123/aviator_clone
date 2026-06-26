import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { adjustBalance } from '../services/ledger';
import { env } from '../config/env';
import { badRequest, conflict, unauthorized, forbidden } from '../utils/errors';
import { asyncHandler } from '../middleware/error';

const REFRESH_COOKIE = 'refreshToken';
const isProd = process.env.NODE_ENV === 'production';
const refreshCookieOpts = {
  httpOnly: true,
  // In prod the frontend and backend live on different domains, so the cookie
  // must be SameSite=None + Secure to be sent on cross-site requests.
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

function issueTokens(user: { _id: unknown; role: 'user' | 'admin'; username: string }) {
  const tokenId = crypto.randomUUID();
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role, username: user.username });
  const refreshToken = signRefreshToken({ sub: String(user._id), tokenId });
  return { accessToken, refreshToken, tokenId };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, referralCode } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) throw conflict('Email or username already taken');

  const referrer = referralCode ? await User.findOne({ referralCode }) : null;

  const user = new User({
    username,
    email,
    role: 'user',
    referralCode: crypto.randomBytes(4).toString('hex'),
    referredBy: referrer?._id,
    emailVerifyToken: crypto.randomBytes(16).toString('hex'),
  });
  await user.setPassword(password);

  // Persist the user (incl. refresh token) BEFORE crediting bonuses. Bonuses are
  // applied via adjustBalance ($inc), so we must not call user.save() afterwards
  // or it would overwrite the credited balance with the stale in-memory value.
  const { accessToken, refreshToken, tokenId } = issueTokens(user);
  user.refreshTokenId = tokenId;
  await user.save();

  // Welcome bonus + referral bonus (sandbox economy; set WELCOME_BONUS=0 to disable).
  let newBalance = user.balance;
  if (env.game.welcomeBonus > 0) {
    newBalance = await adjustBalance({
      userId: user._id,
      amount: env.game.welcomeBonus,
      type: 'bonus',
      description: 'Welcome bonus',
    });
  }
  user.balance = newBalance; // reflect credited balance in the response
  if (referrer && env.game.referralBonus > 0) {
    await adjustBalance({ userId: referrer._id, amount: env.game.referralBonus, type: 'bonus', description: `Referral: ${username}` });
  }

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
  res.status(201).json({ user: user.toJSON(), accessToken });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) throw unauthorized('Invalid credentials');
  if (user.isBanned) throw forbidden('Account banned');

  const { accessToken, refreshToken, tokenId } = issueTokens(user);
  user.refreshTokenId = tokenId;
  user.lastActiveAt = new Date();
  await user.save();

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
  res.json({ user: user.toJSON(), accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw unauthorized('Invalid refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.refreshTokenId !== payload.tokenId) {
    throw unauthorized('Refresh token revoked');
  }

  // rotate
  const { accessToken, refreshToken, tokenId } = issueTokens(user);
  user.refreshTokenId = tokenId;
  await user.save();

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
  res.json({ accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user.sub, { $unset: { refreshTokenId: 1 } });
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ ok: true });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token) throw badRequest('Missing token');
  const user = await User.findOne({ emailVerifyToken: token });
  if (!user) throw badRequest('Invalid verification token');
  user.isVerified = true;
  user.emailVerifyToken = undefined;
  await user.save();
  res.json({ ok: true, message: 'Email verified' });
});

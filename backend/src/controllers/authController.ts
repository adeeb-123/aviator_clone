import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { adjustBalance } from '../services/ledger';
import { getGameEngine } from '../services/gameEngine';
import { env } from '../config/env';
import { badRequest, conflict, unauthorized, forbidden, notFound } from '../utils/errors';
import { asyncHandler } from '../middleware/error';
import { sendMail, verificationEmail, passwordResetEmail } from '../services/mailer';
import { generateTotpSecret, totpKeyUri, verifyTotp } from '../utils/totp';
import { logAuthEvent } from '../services/authEvents';

const REFRESH_COOKIE = 'refreshToken';
const isProd = process.env.NODE_ENV === 'production';
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15-minute lockout after repeated failures
const refreshCookieOpts = {
  httpOnly: true,
  // In prod the frontend and backend live on different domains, so the cookie
  // must be SameSite=None + Secure to be sent on cross-site requests.
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

function issueTokens(user: { _id: unknown; role: 'user' | 'admin'; username: string }, mfa: boolean) {
  const tokenId = crypto.randomUUID();
  const accessToken = signAccessToken({ sub: String(user._id), role: user.role, username: user.username, mfa });
  const refreshToken = signRefreshToken({ sub: String(user._id), tokenId });
  return { accessToken, refreshToken, tokenId };
}

/** sha256 — reset tokens are stored hashed so a DB leak can't be used to reset accounts. */
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, referralCode } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) throw conflict('Email or username already taken');

  // Referral codes are lowercase hex — match case-insensitively so a code typed in
  // any case (or with stray spaces) still resolves.
  const cleanRef = typeof referralCode === 'string' ? referralCode.trim().toLowerCase() : '';
  const referrer = cleanRef ? await User.findOne({ referralCode: cleanRef }) : null;
  if (cleanRef && !referrer) throw badRequest('That referral code is not valid');

  const verifyToken = crypto.randomBytes(16).toString('hex');
  const user = new User({
    username,
    email,
    role: 'user',
    referralCode: crypto.randomBytes(4).toString('hex'),
    referredBy: referrer?._id,
    emailVerifyToken: verifyToken,
  });
  await user.setPassword(password);

  // Persist the user (incl. refresh token) BEFORE crediting bonuses. Bonuses are
  // applied via adjustBalance ($inc), so we must not call user.save() afterwards
  // or it would overwrite the credited balance with the stale in-memory value.
  const { accessToken, refreshToken, tokenId } = issueTokens(user, false);
  user.refreshTokenId = tokenId;
  await user.save();

  // Send the verification email (fire-and-forget; never blocks registration).
  const verifyLink = `${env.frontendUrl}/verify-email?token=${verifyToken}`;
  void sendMail({ to: email, ...verificationEmail(verifyLink) });

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
    const refBalance = await adjustBalance({ userId: referrer._id, amount: env.game.referralBonus, type: 'bonus', description: `Referral: ${username}` });
    // Let the referrer see it immediately if they're online.
    try {
      const eng = getGameEngine();
      eng.emitToUser(String(referrer._id), 'balance:update', { balance: refBalance });
      eng.emitToUser(String(referrer._id), 'user:notify', {
        id: crypto.randomUUID(), kind: 'success', title: 'Referral bonus! 🎉',
        message: `${username} just joined with your code — you earned ₹${env.game.referralBonus}.`, createdAt: new Date(),
      });
    } catch { /* engine not ready — non-fatal */ }
  }

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
  res.status(201).json({ user: user.toJSON(), accessToken });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, twoFactorCode } = req.body;
  // twoFactorSecret is select:false — pull it in for the 2FA check.
  const user = await User.findOne({ email }).select('+twoFactorSecret');

  // Uniform "invalid credentials" for unknown email / wrong password (no user enumeration).
  if (!user) {
    logAuthEvent('login.fail', req, { email });
    throw unauthorized('Invalid credentials');
  }

  // Temporary lockout after repeated failures (brute-force / credential-stuffing).
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    logAuthEvent('login.locked', req, { userId: String(user._id) });
    throw forbidden('Account temporarily locked after too many failed attempts. Try again later.');
  }

  const passwordOk = await user.comparePassword(password);
  if (!passwordOk) {
    user.failedLoginCount = (user.failedLoginCount || 0) + 1;
    if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + LOCK_MS);
      user.failedLoginCount = 0;
      logAuthEvent('login.locked', req, { userId: String(user._id) });
    } else {
      logAuthEvent('login.fail', req, { userId: String(user._id), attempts: user.failedLoginCount });
    }
    await user.save();
    throw unauthorized('Invalid credentials');
  }

  if (user.isBanned) throw forbidden('Account banned');

  // Two-factor: if enabled, a valid TOTP code is required to complete login.
  if (user.twoFactorEnabled) {
    if (!twoFactorCode) {
      logAuthEvent('login.2fa_required', req, { userId: String(user._id) });
      res.status(401).json({ error: 'Two-factor code required', twoFactorRequired: true });
      return;
    }
    if (!user.twoFactorSecret || !verifyTotp(String(twoFactorCode), user.twoFactorSecret)) {
      user.failedLoginCount = (user.failedLoginCount || 0) + 1;
      await user.save();
      logAuthEvent('login.2fa_fail', req, { userId: String(user._id) });
      throw unauthorized('Invalid two-factor code');
    }
  }

  // Success — reset counters and mint tokens (mfa flag mirrors 2FA enrollment).
  user.failedLoginCount = 0;
  user.lockUntil = undefined;
  const { accessToken, refreshToken, tokenId } = issueTokens(user, user.twoFactorEnabled);
  user.refreshTokenId = tokenId;
  user.lastActiveAt = new Date();
  await user.save();

  logAuthEvent('login.success', req, { userId: String(user._id) });
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
    // A presented-but-unrecognised tokenId means the token was rotated/revoked —
    // possible theft/replay. Log it for review.
    if (user) logAuthEvent('refresh.reuse', req, { userId: String(user._id) });
    throw unauthorized('Refresh token revoked');
  }
  if (user.isBanned) throw forbidden('Account banned');

  // rotate; a session that passed 2FA at login stays MFA-satisfied.
  const { accessToken, refreshToken, tokenId } = issueTokens(user, user.twoFactorEnabled);
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
  if (!token || typeof token !== 'string') throw badRequest('Missing token');
  const user = await User.findOne({ emailVerifyToken: token });
  if (!user) throw badRequest('Invalid verification token');
  user.isVerified = true;
  user.emailVerifyToken = undefined;
  await user.save();
  res.json({ ok: true, message: 'Email verified' });
});

// ── Password reset ────────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  // Uniform response regardless of whether the email exists (no account enumeration).
  if (user && !user.isBanned) {
    const raw = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = sha256(raw);
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const link = `${env.frontendUrl}/reset-password?token=${raw}`;
    void sendMail({ to: user.email, ...passwordResetEmail(link) });
    logAuthEvent('password.reset_requested', req, { userId: String(user._id) });
  }
  res.json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  const hashed = sha256(String(token));
  const user = await User.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: new Date() },
  });
  if (!user) throw badRequest('Invalid or expired reset link');

  await user.setPassword(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = new Date();
  user.refreshTokenId = undefined; // revoke every existing session
  user.failedLoginCount = 0;
  user.lockUntil = undefined;
  await user.save();

  logAuthEvent('password.reset_done', req, { userId: String(user._id) });
  res.json({ ok: true, message: 'Password updated. Please log in again.' });
});

// ── Two-factor authentication (TOTP) ──────────────────────────────
export const setup2fa = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.sub);
  if (!user) throw notFound('User');
  if (user.twoFactorEnabled) throw badRequest('Two-factor is already enabled');
  const secret = generateTotpSecret();
  user.twoFactorTempSecret = secret;
  await user.save();
  // Frontend renders `otpauth` as a QR code; `secret` is the manual-entry fallback.
  res.json({ secret, otpauth: totpKeyUri(user.email, secret) });
});

export const enable2fa = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  const user = await User.findById(req.user!.sub).select('+twoFactorTempSecret');
  if (!user) throw notFound('User');
  if (user.twoFactorEnabled) throw badRequest('Two-factor is already enabled');
  if (!user.twoFactorTempSecret) throw badRequest('Start two-factor setup first');
  if (!verifyTotp(String(code), user.twoFactorTempSecret)) throw badRequest('Invalid code');

  user.twoFactorSecret = user.twoFactorTempSecret;
  user.twoFactorTempSecret = undefined;
  user.twoFactorEnabled = true;
  await user.save();

  logAuthEvent('2fa.enabled', req, { userId: String(user._id) });
  res.json({ ok: true, message: 'Two-factor enabled. Please log in again to refresh your session.' });
});

export const disable2fa = asyncHandler(async (req: Request, res: Response) => {
  const { password, code } = req.body;
  const user = await User.findById(req.user!.sub).select('+twoFactorSecret');
  if (!user) throw notFound('User');
  if (!user.twoFactorEnabled) throw badRequest('Two-factor is not enabled');
  if (!(await user.comparePassword(password))) throw unauthorized('Invalid password');
  if (!user.twoFactorSecret || !verifyTotp(String(code), user.twoFactorSecret)) throw badRequest('Invalid code');
  // Admin accounts are required to keep 2FA on.
  if (user.role === 'admin') throw forbidden('Admin accounts must keep two-factor enabled');

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  await user.save();

  logAuthEvent('2fa.disabled', req, { userId: String(user._id) });
  res.json({ ok: true, message: 'Two-factor disabled' });
});

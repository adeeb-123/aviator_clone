import dotenv from 'dotenv';
dotenv.config();

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Ensure a URL has a scheme (PaaS service refs often provide a bare host). */
function withScheme(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT ?? '5000', 10),

  mongoUri: required('MONGODB_URI', 'mongodb://localhost:27017/aviator'),
  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),
  redisDisabled: process.env.REDIS_DISABLED === 'true',

  jwtSecret: required('JWT_SECRET', 'dev_access_secret'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret'),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',

  stripeSecret: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',

  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },

  frontendUrl: withScheme(process.env.FRONTEND_URL ?? 'http://localhost:3000'),
  backendUrl: withScheme(process.env.BACKEND_URL ?? 'http://localhost:5000'),

  game: {
    houseEdge: parseFloat(process.env.HOUSE_EDGE ?? '0.03'),
    minBet: parseFloat(process.env.MIN_BET ?? '1'),
    maxBet: parseFloat(process.env.MAX_BET ?? '1000'),
    bettingWindowMs: parseInt(process.env.BETTING_WINDOW_MS ?? '10000', 10),
    roundPauseMs: parseInt(process.env.ROUND_PAUSE_MS ?? '6000', 10),
    tickMs: 100,
    welcomeBonus: parseFloat(process.env.WELCOME_BONUS ?? '100'),
    referralBonus: parseFloat(process.env.REFERRAL_BONUS ?? '25'),
    minDeposit: parseFloat(process.env.MIN_DEPOSIT ?? '50'), // Stripe needs ≈ $0.50 min
    dailyBase: parseFloat(process.env.DAILY_REWARD_BASE ?? '10'), // ₹ per streak day
    dailyCap: parseFloat(process.env.DAILY_REWARD_CAP ?? '100'),
  },

  // Require admins to have TOTP 2FA to reach admin APIs. Default on; set
  // ENFORCE_ADMIN_MFA=false to bootstrap the very first admin before enrolling.
  enforceAdminMfa: process.env.ENFORCE_ADMIN_MFA !== 'false',

  // Admin "force crash" overrides provably-fair. It is ALWAYS disabled in production
  // (a deployed build can never manipulate outcomes), regardless of the env var.
  allowForceCrash: process.env.NODE_ENV !== 'production' && process.env.ALLOW_FORCE_CRASH !== 'false',

  admin: {
    email: process.env.ADMIN_EMAIL ?? 'admin@aviator.local',
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'Admin123!',
  },
};

// Fail fast: never let a production build boot with the built-in dev secrets or a
// weak (short) JWT secret — a known/guessable signing key lets anyone forge admin
// tokens. This runs at import time so a misconfigured deploy crashes on startup.
if (env.isProd) {
  const weak: string[] = [];
  if (!process.env.JWT_SECRET || env.jwtSecret === 'dev_access_secret' || env.jwtSecret.length < 32) weak.push('JWT_SECRET');
  if (!process.env.JWT_REFRESH_SECRET || env.jwtRefreshSecret === 'dev_refresh_secret' || env.jwtRefreshSecret.length < 32) weak.push('JWT_REFRESH_SECRET');
  if (env.jwtSecret === env.jwtRefreshSecret) weak.push('JWT_SECRET must differ from JWT_REFRESH_SECRET');
  if (weak.length) {
    throw new Error(`Refusing to start in production with insecure JWT secrets: ${weak.join(', ')}. Set strong, distinct values (>=32 chars).`);
  }
  // Non-fatal: warn loudly (don't crash the deploy) if the admin password is still
  // the built-in default — the operator should change it in the dashboard ASAP.
  if (env.admin.password === 'Admin123!') {
    // eslint-disable-next-line no-console
    console.warn('[SECURITY] ADMIN_PASSWORD is still the default "Admin123!" — change it in your environment now.');
  }
}

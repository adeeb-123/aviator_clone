import rateLimit from 'express-rate-limit';

// Don't rate-limit the test suite (it fires many auth calls from one IP).
const skip = () => process.env.NODE_ENV === 'test';

/** Global: 100 requests / minute / IP. */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many requests, slow down.' },
});

/** Stricter limiter for auth endpoints to deter brute-force. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many authentication attempts. Try again later.' },
});

/** Registration limiter — curbs mass multi-account / bonus farming from one IP. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.MAX_REGISTRATIONS_PER_HOUR ?? '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many accounts created from this network. Try again later.' },
});

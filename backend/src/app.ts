import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './config/env';
import { globalLimiter } from './middleware/rateLimit';
import { notFoundHandler, errorHandler } from './middleware/error';
import { webhook } from './controllers/paymentController';

/**
 * In production TLS terminates at the platform edge, which forwards the original
 * scheme in `x-forwarded-proto`. Reject/redirect any request that reached us over
 * plain HTTP so credentials and tokens are never exchanged in the clear. The
 * health probe is exempt so internal (http) load-balancer checks keep working.
 */
function enforceHttps(req: Request, res: Response, next: NextFunction): void {
  if (!env.isProd || req.path === '/health') return next();
  const proto = req.headers['x-forwarded-proto'];
  const isHttps = req.secure || proto === 'https' || (Array.isArray(proto) ? proto.includes('https') : false);
  if (isHttps) return next();
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    return;
  }
  res.status(403).json({ error: 'HTTPS required' });
}

import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import gameRoutes from './routes/game';
import adminRoutes from './routes/admin';
import tournamentRoutes from './routes/tournament';
import cryptoRoutes from './routes/crypto';
import paymentRoutes from './routes/payment';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(enforceHttps);

  // Security headers. This service returns only JSON, so the CSP is locked down to
  // "load nothing" and the response may not be framed anywhere (clickjacking).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      frameguard: { action: 'deny' },
    }),
  );
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    }),
  );

  // Stripe webhook needs the RAW body — must be registered before json parser.
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), webhook);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  // Strip any keys containing `$` or `.` from body/query/params to block NoSQL
  // operator injection (e.g. { email: { "$gt": "" } } matching any user).
  app.use(mongoSanitize());
  app.use(globalLimiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/game', gameRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/tournaments', tournamentRoutes);
  app.use('/api/crypto', cryptoRoutes);
  app.use('/api/payments', paymentRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

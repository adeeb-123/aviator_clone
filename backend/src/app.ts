import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { globalLimiter } from './middleware/rateLimit';
import { notFoundHandler, errorHandler } from './middleware/error';
import { webhook } from './controllers/paymentController';

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
  app.use(helmet());
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

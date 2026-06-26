import http from 'http';
import crypto from 'crypto';
import { Server } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { initGameEngine } from './services/gameEngine';
import { initAlerts } from './services/alertService';
import { setupSocket } from './socket';
import { User } from './models/User';
import { logger } from './utils/logger';

/**
 * Ensure an admin account exists on boot when ADMIN_* env vars are configured.
 * Idempotent — only creates the admin if it's missing. Lets a fresh PaaS deploy
 * have a working admin dashboard without a manual seed step.
 */
async function ensureAdmin(): Promise<void> {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  try {
    const existing = await User.findOne({ email: env.admin.email });
    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        logger.info('Existing user promoted to admin');
      }
      return;
    }
    const admin = new User({
      username: env.admin.username,
      email: env.admin.email,
      role: 'admin',
      isVerified: true,
      balance: 100000,
      referralCode: crypto.randomBytes(4).toString('hex'),
    });
    await admin.setPassword(env.admin.password);
    await admin.save();
    logger.info(`Admin account seeded on boot: ${env.admin.email}`);
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'ensureAdmin failed (continuing startup)');
  }
}

export async function bootstrap(): Promise<void> {
  // Keep the process alive on transient async errors. The game loop fires several
  // background promises (DB writes, cashouts); a single rejection would otherwise
  // crash Node and trigger a restart loop on the host. Log loudly instead.
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason: reason instanceof Error ? reason.message : reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err: err.message, stack: err.stack }, 'Uncaught exception');
  });

  await connectDB();
  await connectRedis();
  await ensureAdmin();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: env.frontendUrl, credentials: true },
    transports: ['websocket', 'polling'],
  });

  const engine = initGameEngine(io);
  initAlerts(io);
  await setupSocket(io);
  engine.start();

  server.listen(env.port, () => {
    logger.info(`🚀 Backend listening on :${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    engine.stop();
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

// Only auto-start when run directly (the dev launcher imports bootstrap instead).
if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error({ err }, 'Fatal startup error');
    process.exit(1);
  });
}

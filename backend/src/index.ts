import http from 'http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { initGameEngine } from './services/gameEngine';
import { setupSocket } from './socket';
import { logger } from './utils/logger';

export async function bootstrap(): Promise<void> {
  await connectDB();
  await connectRedis();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: env.frontendUrl, credentials: true },
    transports: ['websocket', 'polling'],
  });

  const engine = initGameEngine(io);
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

/**
 * Zero-dependency local launcher: boots an in-memory MongoDB and disables Redis,
 * then starts the full server. Lets you run the game without installing MongoDB,
 * Redis or Docker. NOT for production (data is lost on restart).
 *
 *   npm run dev:local
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main(): Promise<void> {
  const mongo = await MongoMemoryServer.create({ instance: { dbName: 'aviator' } });
  // Must be set BEFORE importing config/env (read at import time).
  process.env.MONGODB_URI = mongo.getUri('aviator');
  process.env.REDIS_DISABLED = 'true';
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'dev_access_secret';
  if (!process.env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = 'dev_refresh_secret';

  // eslint-disable-next-line no-console
  console.log(`[dev] In-memory MongoDB at ${process.env.MONGODB_URI}`);

  const { bootstrap } = await import('../index');
  const { User } = await import('../models/User');
  const { env } = await import('../config/env');

  await bootstrap();

  // Seed an admin so the dashboard is usable immediately.
  const crypto = await import('crypto');
  const existing = await User.findOne({ email: env.admin.email });
  if (!existing) {
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
    // eslint-disable-next-line no-console
    console.log(`[dev] Admin seeded: ${env.admin.email} / ${env.admin.password}`);
  }

  const stop = async () => {
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[dev] launcher failed', err);
  process.exit(1);
});

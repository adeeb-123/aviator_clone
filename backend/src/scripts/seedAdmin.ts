import crypto from 'crypto';
import { connectDB, disconnectDB } from '../config/db';
import { User } from '../models/User';
import { env } from '../config/env';
import { logger } from '../utils/logger';

async function run(): Promise<void> {
  await connectDB();
  const existing = await User.findOne({ email: env.admin.email });
  if (existing) {
    existing.role = 'admin';
    await existing.save();
    logger.info(`Admin already exists, ensured role: ${env.admin.email}`);
  } else {
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
    logger.info(`Admin created: ${env.admin.email} / ${env.admin.password}`);
  }
  await disconnectDB();
  process.exit(0);
}

run().catch((err) => {
  logger.error({ err }, 'seedAdmin failed');
  process.exit(1);
});

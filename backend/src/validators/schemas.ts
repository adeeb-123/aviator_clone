import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscore only'),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  twoFactorCode: z.string().optional(),
});

export const updateProfileSchema = z.object({
  avatar: z.string().max(300).optional(), // emoji or image URL
  bio: z.string().max(280).optional(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).optional(),
});

export const favoriteSchema = z.object({
  name: z.string().min(1).max(40),
  amount: z.number().positive(),
  autoCashout: z.number().min(1.01).optional(),
});

export const depositSchema = z.object({
  amount: z.number().positive().max(100000),
});

export const withdrawSchema = z.object({
  amount: z.number().positive(),
});

export const transferSchema = z.object({
  toUsername: z.string(),
  amount: z.number().positive(),
});

export const verifyRoundSchema = z.object({
  serverSeed: z.string().min(1),
  clientSeed: z.string().min(1),
  nonce: z.coerce.number().int().nonnegative(),
  houseEdge: z.coerce.number().min(0).max(0.2).optional(),
});

export const adminAdjustSchema = z.object({
  userId: z.string(),
  amount: z.number(),
  reason: z.string().optional(),
});

export const adminCrashSchema = z.object({
  crashPoint: z.number().min(1),
});

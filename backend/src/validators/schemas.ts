import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),
  email: z.string().email('Enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long (max 100 characters)'),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
  twoFactorCode: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Missing reset token'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long (max 100 characters)'),
});

export const enable2faSchema = z.object({
  code: z.string().min(6).max(8),
});

export const disable2faSchema = z.object({
  password: z.string().min(1, 'Enter your password'),
  code: z.string().min(6).max(8),
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
  amount: z.number()
    .finite('Enter a valid amount')
    .positive('Amount must be positive')
    .min(50, 'Minimum withdrawal is ₹50')
    .max(200000, 'Maximum single withdrawal is ₹2,00,000'),
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

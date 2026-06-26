import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface FavoriteStrategy {
  name: string;
  amount: number;
  autoCashout?: number;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  balance: number;
  avatar?: string;
  bio?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  isBanned: boolean;
  isSuspended: boolean;
  twoFactorEnabled: boolean;
  vipTier: number;
  refreshTokenId?: string;
  emailVerifyToken?: string;
  referralCode: string;
  referredBy?: Types.ObjectId;
  favorites: FavoriteStrategy[];
  lastActiveAt: Date;
  dailyStreak: number;
  lastDailyClaim?: Date;
  questDay?: Date;
  questClaimed: string[];
  claimedBadges: string[];
  lastCashbackAt?: Date;
  chatMutedUntil?: Date;
  lastSpinAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  setPassword(plain: string): Promise<void>;
  comparePassword(plain: string): Promise<boolean>;
}

const favoriteSchema = new Schema<FavoriteStrategy>(
  {
    name: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    autoCashout: { type: Number, min: 1.01 },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    avatar: { type: String },
    bio: { type: String, maxlength: 280 },
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    isVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    vipTier: { type: Number, default: 0 },
    refreshTokenId: { type: String },
    emailVerifyToken: { type: String },
    referralCode: { type: String, unique: true, index: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    favorites: { type: [favoriteSchema], default: [] },
    lastActiveAt: { type: Date, default: Date.now },
    dailyStreak: { type: Number, default: 0 },
    lastDailyClaim: { type: Date },
    questDay: { type: Date },
    questClaimed: { type: [String], default: [] },
    claimedBadges: { type: [String], default: [] },
    lastCashbackAt: { type: Date },
    chatMutedUntil: { type: Date },
    lastSpinAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.methods.setPassword = async function (plain: string): Promise<void> {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    const r = ret as unknown as Record<string, unknown>;
    delete r.passwordHash;
    delete r.refreshTokenId;
    delete r.emailVerifyToken;
    delete r.__v;
    return r;
  },
});

export const User = model<IUser>('User', userSchema);

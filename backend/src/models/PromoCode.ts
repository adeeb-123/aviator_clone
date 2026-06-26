import { Schema, model, Types } from 'mongoose';

export interface IPromoCode {
  code: string;
  amount: number;
  maxUses: number; // 0 = unlimited
  uses: number;
  active: boolean;
  expiresAt?: Date;
  createdBy?: string;
  redeemedBy: Types.ObjectId[];
  createdAt: Date;
}

const promoSchema = new Schema<IPromoCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    maxUses: { type: Number, default: 0 }, // 0 = unlimited total redemptions
    uses: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date },
    createdBy: { type: String },
    redeemedBy: { type: [Schema.Types.ObjectId], default: [], ref: 'User' }, // one redemption per user
  },
  { timestamps: true },
);

export const PromoCode = model<IPromoCode>('PromoCode', promoSchema);

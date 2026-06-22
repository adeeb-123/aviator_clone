import { Schema, model, Document, Types } from 'mongoose';

export type BetStatus = 'pending' | 'cashed-out' | 'lost';

export interface IBet extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  username: string;
  roundId: number;
  slot: 1 | 2; // dual-bet slot
  amount: number;
  autoCashout?: number;
  cashoutMultiplier?: number;
  payout: number;
  status: BetStatus;
  isAutoCashout: boolean;
  createdAt: Date;
}

const betSchema = new Schema<IBet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true },
    roundId: { type: Number, required: true, index: true },
    slot: { type: Number, enum: [1, 2], default: 1 },
    amount: { type: Number, required: true, min: 0 },
    autoCashout: { type: Number, min: 1.01 },
    cashoutMultiplier: { type: Number },
    payout: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'cashed-out', 'lost'], default: 'pending', index: true },
    isAutoCashout: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

betSchema.index({ userId: 1, createdAt: -1 });
betSchema.index({ roundId: 1, slot: 1 });

export const Bet = model<IBet>('Bet', betSchema);

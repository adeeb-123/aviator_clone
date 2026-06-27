import { Schema, model, Types } from 'mongoose';

export interface ISideBet {
  roundId: number;
  userId: Types.ObjectId;
  username: string;
  marketId: string;
  threshold: number;
  payout: number;
  amount: number;
  status: 'pending' | 'won' | 'lost';
  winAmount: number;
  createdAt: Date;
}

const sideBetSchema = new Schema<ISideBet>(
  {
    roundId: { type: Number, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true },
    marketId: { type: String, required: true },
    threshold: { type: Number, required: true },
    payout: { type: Number, required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'won', 'lost'], default: 'pending' },
    winAmount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const SideBet = model<ISideBet>('SideBet', sideBetSchema);

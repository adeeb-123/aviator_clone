import { Schema, model, Document, Types } from 'mongoose';

export type TxType = 'deposit' | 'withdraw' | 'bet' | 'win' | 'refund' | 'bonus' | 'admin-adjust';

export interface ITransaction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: TxType;
  amount: number; // signed: positive credit, negative debit
  balanceAfter: number;
  description: string;
  reference?: string; // e.g. roundId, stripe payment intent
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['deposit', 'withdraw', 'bet', 'win', 'refund', 'bonus', 'admin-adjust'],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, default: '' },
    reference: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

transactionSchema.index({ userId: 1, createdAt: -1 });

export const Transaction = model<ITransaction>('Transaction', transactionSchema);

import { Schema, model, Types } from 'mongoose';

export interface ICryptoTransaction {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  username: string;
  type: 'deposit' | 'withdrawal';
  coin: string;
  cryptoAmount: number;
  inrAmount: number;
  rate: number; // INR per coin at the time
  address: string; // deposit address (deposit) or destination address (withdrawal)
  txHash?: string; // simulated on-chain tx reference
  status: 'pending' | 'confirmed' | 'completed' | 'rejected';
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cryptoTxSchema = new Schema<ICryptoTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true },
    type: { type: String, enum: ['deposit', 'withdrawal'], required: true, index: true },
    coin: { type: String, required: true },
    cryptoAmount: { type: Number, required: true },
    inrAmount: { type: Number, required: true },
    rate: { type: Number, required: true },
    address: { type: String, required: true },
    txHash: { type: String },
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'rejected'], default: 'pending', index: true },
    note: { type: String },
  },
  { timestamps: true },
);

export const CryptoTransaction = model<ICryptoTransaction>('CryptoTransaction', cryptoTxSchema);

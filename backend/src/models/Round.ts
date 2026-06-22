import { Schema, model, Document, Types } from 'mongoose';

export type RoundStatus = 'pending' | 'betting' | 'running' | 'crashed';

export interface IRound extends Document {
  _id: Types.ObjectId;
  roundId: number;
  nonce: number;
  crashPoint: number;
  serverSeedHash: string; // committed BEFORE the round (public)
  serverSeed?: string; // revealed after seed rotation
  serverSeedId: Types.ObjectId;
  clientSeed: string;
  status: RoundStatus;
  startTime?: Date;
  endTime?: Date;
  totalBets: number;
  totalWagered: number;
  totalPayout: number;
  createdAt: Date;
}

const roundSchema = new Schema<IRound>(
  {
    roundId: { type: Number, required: true, unique: true, index: true },
    nonce: { type: Number, required: true },
    crashPoint: { type: Number, required: true },
    serverSeedHash: { type: String, required: true },
    serverSeed: { type: String },
    serverSeedId: { type: Schema.Types.ObjectId, ref: 'ServerSeed', required: true },
    clientSeed: { type: String, required: true },
    status: { type: String, enum: ['pending', 'betting', 'running', 'crashed'], default: 'pending', index: true },
    startTime: { type: Date },
    endTime: { type: Date },
    totalBets: { type: Number, default: 0 },
    totalWagered: { type: Number, default: 0 },
    totalPayout: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

roundSchema.index({ createdAt: -1 });

export const Round = model<IRound>('Round', roundSchema);

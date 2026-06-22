import { Schema, model, Document, Types } from 'mongoose';

export interface IServerSeed extends Document {
  _id: Types.ObjectId;
  seed: string; // raw seed (revealed once rotated/expired)
  hash: string; // sha256(seed) — committed publicly
  active: boolean;
  nonce: number; // increments per round on this seed
  expiresAt: Date;
  revealedAt?: Date;
  createdAt: Date;
}

const serverSeedSchema = new Schema<IServerSeed>(
  {
    seed: { type: String, required: true },
    hash: { type: String, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
    nonce: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    revealedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ServerSeed = model<IServerSeed>('ServerSeed', serverSeedSchema);

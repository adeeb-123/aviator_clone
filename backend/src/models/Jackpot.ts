import { Schema, model } from 'mongoose';

/** Singleton progressive jackpot pot (key: 'main'). */
const jackpotSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    pot: { type: Number, default: 0 },
    lastWonBy: { type: String },
    lastWonAmount: { type: Number },
    lastWonAt: { type: Date },
  },
  { timestamps: true },
);

export const Jackpot = model('Jackpot', jackpotSchema);

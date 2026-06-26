import { Schema, model, Types } from 'mongoose';

export type TournamentMetric = 'wagered' | 'profit' | 'wins' | 'multiplier';
export type TournamentStatus = 'scheduled' | 'active' | 'ended';

export interface TournamentWinner {
  rank: number;
  userId: Types.ObjectId;
  username: string;
  score: number;
  prize: number;
}

export interface ITournament {
  _id: Types.ObjectId;
  name: string;
  metric: TournamentMetric;
  startAt: Date;
  endAt: Date;
  prizes: number[]; // ₹ for rank 1, 2, 3 …
  status: TournamentStatus;
  paidOut: boolean;
  winners: TournamentWinner[];
  createdBy?: string;
  createdAt: Date;
}

const tournamentSchema = new Schema<ITournament>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    metric: { type: String, enum: ['wagered', 'profit', 'wins', 'multiplier'], default: 'wagered' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    prizes: { type: [Number], default: [] },
    status: { type: String, enum: ['scheduled', 'active', 'ended'], default: 'scheduled', index: true },
    paidOut: { type: Boolean, default: false },
    winners: { type: [{ rank: Number, userId: { type: Schema.Types.ObjectId, ref: 'User' }, username: String, score: Number, prize: Number }], default: [] },
    createdBy: { type: String },
  },
  { timestamps: true },
);

export const Tournament = model<ITournament>('Tournament', tournamentSchema);

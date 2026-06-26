import { Schema, model, Document, Types } from 'mongoose';

export type AlertType =
  | 'large-bet'
  | 'big-win'
  | 'high-balance'
  | 'large-withdrawal'
  | 'large-deposit'
  | 'big-payout';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface IAlert extends Document {
  _id: Types.ObjectId;
  type: AlertType;
  severity: AlertSeverity;
  userId?: Types.ObjectId;
  username?: string;
  message: string;
  meta: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    type: { type: String, required: true, index: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    username: { type: String },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

alertSchema.index({ read: 1, createdAt: -1 });
// auto-expire alerts after 30 days to keep the collection lean
alertSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Alert = model<IAlert>('Alert', alertSchema);

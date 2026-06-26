import { Schema, model, Types } from 'mongoose';

/** Immutable record of privileged admin actions for accountability. */
const adminAuditSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    adminUsername: { type: String, required: true },
    action: { type: String, required: true, index: true },
    detail: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export interface AdminAuditDoc {
  adminId?: Types.ObjectId;
  adminUsername: string;
  action: string;
  detail: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

export const AdminAudit = model('AdminAudit', adminAuditSchema);

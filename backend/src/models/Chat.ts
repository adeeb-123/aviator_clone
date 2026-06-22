import { Schema, model, Document, Types } from 'mongoose';

export interface IChat extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  username: string;
  avatar?: string;
  message: string;
  room: string;
  deleted: boolean;
  createdAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    avatar: { type: String },
    message: { type: String, required: true, maxlength: 280 },
    room: { type: String, default: 'global', index: true },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

chatSchema.index({ room: 1, createdAt: -1 });

export const Chat = model<IChat>('Chat', chatSchema);

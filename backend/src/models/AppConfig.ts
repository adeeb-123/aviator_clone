import { Schema, model } from 'mongoose';

/** Singleton key/value store for runtime-editable settings (one doc per key). */
const appConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const AppConfig = model('AppConfig', appConfigSchema);

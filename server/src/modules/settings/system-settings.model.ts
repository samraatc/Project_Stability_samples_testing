import { Schema, model, type Types } from 'mongoose';

export interface ISystemSettings {
  _id: Types.ObjectId;
  key: string;
  value: Record<string, unknown>;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const SystemSettingsModel = model<ISystemSettings>('SystemSettings', systemSettingsSchema);

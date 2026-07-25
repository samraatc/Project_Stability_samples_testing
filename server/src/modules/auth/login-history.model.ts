import { Schema, model, type Types } from 'mongoose';

export interface ILoginHistory {
  _id: Types.ObjectId;
  user: Types.ObjectId | null;
  email: string;
  success: boolean;
  reason: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

const loginHistorySchema = new Schema<ILoginHistory>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, required: true, lowercase: true },
    success: { type: Boolean, required: true },
    reason: { type: String, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

loginHistorySchema.index({ createdAt: -1 });

export const LoginHistoryModel = model<ILoginHistory>('LoginHistory', loginHistorySchema);

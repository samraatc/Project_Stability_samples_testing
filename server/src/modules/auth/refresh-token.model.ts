import { Schema, model, type Types } from 'mongoose';

export interface IRefreshToken {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  rememberMe: boolean;
  createdByIp: string;
  userAgent: string;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    rememberMe: { type: Boolean, default: false },
    createdByIp: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
  },
  { timestamps: true },
);

// MongoDB purges expired sessions automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<IRefreshToken>('RefreshToken', refreshTokenSchema);

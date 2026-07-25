import type { HydratedDocument, Types } from 'mongoose';
import { RefreshTokenModel, type IRefreshToken } from './refresh-token.model';

export type RefreshTokenDocument = HydratedDocument<IRefreshToken>;

export const refreshTokenRepository = {
  create(data: Partial<IRefreshToken>): Promise<RefreshTokenDocument> {
    return RefreshTokenModel.create(data);
  },

  findByTokenHash(tokenHash: string): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({ tokenHash }).exec();
  },

  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await RefreshTokenModel.updateMany(
      { user: userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ).exec();
  },
};

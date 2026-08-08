import type { HydratedDocument, Types } from 'mongoose';
import { UserModel, type IUser } from './user.model';
import type { IRole } from '../roles/role.model';

export type UserDocument = HydratedDocument<IUser>;
export type UserWithRole = HydratedDocument<Omit<IUser, 'role'> & { role: IRole }>;

export const userRepository = {
  findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase(), isDeleted: false }).exec();
  },

  findByEmailWithRole(email: string): Promise<UserWithRole | null> {
    return UserModel.findOne({ email: email.toLowerCase(), isDeleted: false })
      .populate<{ role: IRole }>('role')
      .exec() as Promise<UserWithRole | null>;
  },

  findByIdWithRole(id: string | Types.ObjectId): Promise<UserWithRole | null> {
    return UserModel.findOne({ _id: id, isDeleted: false })
      .populate<{ role: IRole }>('role')
      .exec() as Promise<UserWithRole | null>;
  },

  findByResetTokenHash(tokenHash: string): Promise<UserDocument | null> {
    return UserModel.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
      isDeleted: false,
    }).exec();
  },

  create(data: Partial<IUser>): Promise<UserDocument> {
    return UserModel.create(data);
  },

  countByRole(roleId: Types.ObjectId): Promise<number> {
    return UserModel.countDocuments({ role: roleId, isDeleted: false }).exec();
  },
};

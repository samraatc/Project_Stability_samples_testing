import type { HydratedDocument } from 'mongoose';
import { RoleModel, type IRole } from './role.model';

export type RoleDocument = HydratedDocument<IRole>;

export const roleRepository = {
  findByName(name: string): Promise<RoleDocument | null> {
    return RoleModel.findOne({ name: name.toLowerCase() }).exec();
  },

  upsertByName(
    name: string,
    data: Pick<IRole, 'description' | 'permissions' | 'isSystem'>,
  ): Promise<RoleDocument | null> {
    return RoleModel.findOneAndUpdate(
      { name: name.toLowerCase() },
      { $set: data, $setOnInsert: { name: name.toLowerCase() } },
      { upsert: true, new: true },
    ).exec();
  },
};

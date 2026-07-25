import { Types, type FilterQuery } from 'mongoose';
import { AppError } from '../../utils/app-error';
import { hashPassword } from '../../utils/password';
import { escapeRegex, paginated, type Paginated } from '../../utils/query';
import { UserModel, type IUser } from './user.model';
import { RoleModel, type IRole } from '../roles/role.model';
import { refreshTokenRepository } from '../auth/refresh-token.repository';
import { AUDIT_ACTIONS, recordAudit } from '../audit/audit.service';
import { ROLE_NAMES } from '../../constants/permissions';
import type { AuthUser, RequestMeta } from '../auth/auth.types';
import type {
  CreateUserInput,
  ListUsersQuery,
  ResetPasswordInput,
  UpdateUserInput,
} from './user.validation';

export interface ManagedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: { id: string; name: string };
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}

type UserWithRoleLean = Omit<IUser, 'role'> & { role: IRole };

function toManagedUser(user: UserWithRoleLean): ManagedUser {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: { id: user.role._id.toString(), name: user.role.name },
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

async function loadTarget(id: string): Promise<UserWithRoleLean> {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('User not found', 404);
  }
  const user = await UserModel.findOne({ _id: id, isDeleted: false })
    .populate<{ role: IRole }>('role')
    .lean<UserWithRoleLean>();
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
}

async function resolveRole(roleId: string, actor: AuthUser): Promise<IRole> {
  const role = await RoleModel.findById(roleId).lean<IRole>();
  if (!role) {
    throw new AppError('Role not found', 400);
  }
  // Only a super admin may grant the super-admin role.
  if (role.name === ROLE_NAMES.SUPER_ADMIN && actor.role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new AppError('Only a super admin can assign the super-admin role', 403);
  }
  return role;
}

function assertActorMayManage(target: UserWithRoleLean, actor: AuthUser): void {
  if (target.role.name === ROLE_NAMES.SUPER_ADMIN && actor.role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new AppError('Only a super admin can manage super-admin accounts', 403);
  }
}

/** The system must never lose its last active super admin. */
async function assertNotLastSuperAdmin(target: UserWithRoleLean): Promise<void> {
  if (target.role.name !== ROLE_NAMES.SUPER_ADMIN) return;
  const superAdminRole = await RoleModel.findOne({ name: ROLE_NAMES.SUPER_ADMIN }).lean<IRole>();
  const others = await UserModel.countDocuments({
    _id: { $ne: target._id },
    role: superAdminRole?._id,
    status: 'active',
    isDeleted: false,
  });
  if (others === 0) {
    throw new AppError('Cannot remove or demote the last active super admin', 400);
  }
}

export const userService = {
  async list(query: ListUsersQuery): Promise<Paginated<ManagedUser>> {
    const filter: FilterQuery<IUser> = { isDeleted: false };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.role) {
      const role = await RoleModel.findOne({ name: query.role.toLowerCase() }).lean<IRole>();
      filter.role = role?._id ?? new Types.ObjectId('000000000000000000000000');
    }
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }];
    }

    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate<{ role: IRole }>('role')
        .lean<UserWithRoleLean[]>(),
      UserModel.countDocuments(filter),
    ]);

    return paginated(items.map(toManagedUser), total, query.page, query.limit);
  },

  async create(input: CreateUserInput, actor: AuthUser, meta: RequestMeta): Promise<ManagedUser> {
    const existing = await UserModel.findOne({ email: input.email.toLowerCase() }).lean();
    if (existing) {
      throw new AppError('A user with this email already exists', 409);
    }

    const role = await resolveRole(input.roleId, actor);

    const created = await UserModel.create({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      role: role._id,
      status: 'active',
      createdBy: new Types.ObjectId(actor.id),
    });

    recordAudit({
      actor: new Types.ObjectId(actor.id),
      action: AUDIT_ACTIONS.USER_CREATE,
      resource: 'users',
      resourceId: created._id.toString(),
      details: { email: input.email, role: role.name },
      ...meta,
    });

    return toManagedUser({ ...created.toObject(), role });
  },

  async update(
    id: string,
    input: UpdateUserInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<ManagedUser> {
    const target = await loadTarget(id);
    assertActorMayManage(target, actor);

    if (actor.id === id && input.status === 'inactive') {
      throw new AppError('You cannot deactivate your own account', 400);
    }

    const changes: Partial<IUser> & { updatedBy: Types.ObjectId } = {
      updatedBy: new Types.ObjectId(actor.id),
    };
    let newRole: IRole | null = null;
    let sessionsMustDie = false;

    if (input.firstName) changes.firstName = input.firstName;
    if (input.lastName) changes.lastName = input.lastName;

    if (input.roleId && input.roleId !== target.role._id.toString()) {
      newRole = await resolveRole(input.roleId, actor);
      await assertNotLastSuperAdmin(target);
      changes.role = newRole._id;
      sessionsMustDie = true;
    }

    if (input.status && input.status !== target.status) {
      if (input.status === 'inactive') {
        await assertNotLastSuperAdmin(target);
        sessionsMustDie = true;
      }
      changes.status = input.status;
    }

    await UserModel.updateOne({ _id: target._id }, { $set: changes });

    if (sessionsMustDie) {
      await refreshTokenRepository.revokeAllForUser(target._id);
    }

    recordAudit({
      actor: new Types.ObjectId(actor.id),
      action: AUDIT_ACTIONS.USER_UPDATE,
      resource: 'users',
      resourceId: id,
      details: { ...input },
      ...meta,
    });

    return loadTarget(id).then(toManagedUser);
  },

  async softDelete(id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    if (actor.id === id) {
      throw new AppError('You cannot delete your own account', 400);
    }
    const target = await loadTarget(id);
    assertActorMayManage(target, actor);
    await assertNotLastSuperAdmin(target);

    await UserModel.updateOne(
      { _id: target._id },
      { $set: { isDeleted: true, status: 'inactive', updatedBy: new Types.ObjectId(actor.id) } },
    );
    await refreshTokenRepository.revokeAllForUser(target._id);

    recordAudit({
      actor: new Types.ObjectId(actor.id),
      action: AUDIT_ACTIONS.USER_DELETE,
      resource: 'users',
      resourceId: id,
      details: { email: target.email },
      ...meta,
    });
  },

  async resetPassword(
    id: string,
    input: ResetPasswordInput,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<void> {
    const target = await loadTarget(id);
    assertActorMayManage(target, actor);

    const newHash = await hashPassword(input.newPassword);
    await UserModel.updateOne(
      { _id: target._id },
      { $set: { passwordHash: newHash, updatedBy: new Types.ObjectId(actor.id) } },
    );

    // Revoke all sessions so the user must re-login with the new password
    await refreshTokenRepository.revokeAllForUser(target._id);

    recordAudit({
      actor: new Types.ObjectId(actor.id),
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      resource: 'users',
      resourceId: id,
      details: { email: target.email, resetBy: actor.id },
      ...meta,
    });
  },
};

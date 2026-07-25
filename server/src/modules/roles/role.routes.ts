import { Router } from 'express';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { AppError } from '../../utils/app-error';
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_NAMES } from '../../constants/permissions';
import { RoleModel } from './role.model';
import { UserModel } from '../users/user.model';
import { AUDIT_ACTIONS, recordAudit } from '../audit/audit.service';

export const rolesRouter = Router();

rolesRouter.use(authenticate);

const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(100),
});

/**
 * @openapi
 * /roles:
 *   get:
 *     summary: List roles with permissions and user counts
 *     tags: [Roles]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Roles with the full permission catalog }
 */
rolesRouter.get(
  '/',
  requirePermission(PERMISSIONS.ROLES_READ),
  async (_req: Request, res: Response) => {
    const roles = await RoleModel.find().sort({ name: 1 }).lean();
    const counts = await UserModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { isDeleted: false } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    const countByRole = new Map(counts.map((c) => [c._id.toString(), c.count]));

    res.json({
      success: true,
      data: {
        catalog: ALL_PERMISSIONS,
        roles: roles.map((role) => ({
          id: role._id.toString(),
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystem: role.isSystem,
          userCount: countByRole.get(role._id.toString()) ?? 0,
        })),
      },
    });
  },
);

/**
 * @openapi
 * /roles/{id}/permissions:
 *   put:
 *     summary: Replace a role's permission set (super-admin role is immutable)
 *     tags: [Roles]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated role }
 *       400: { description: Super-admin role cannot be modified }
 */
rolesRouter.put(
  '/:id/permissions',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate(updateRolePermissionsSchema),
  async (req: Request, res: Response) => {
    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    if (role.name === ROLE_NAMES.SUPER_ADMIN) {
      throw new AppError('The super-admin role always holds every permission', 400);
    }

    const { permissions } = req.body as { permissions: string[] };
    role.permissions = [...new Set(permissions)];
    await role.save();

    recordAudit({
      actor: new Types.ObjectId(req.user!.id),
      action: AUDIT_ACTIONS.ROLE_UPDATE,
      resource: 'roles',
      resourceId: role._id.toString(),
      details: { name: role.name, permissions: role.permissions },
      ip: req.ip ?? '',
      userAgent: req.get('user-agent') ?? '',
    });

    res.json({
      success: true,
      data: {
        id: role._id.toString(),
        name: role.name,
        permissions: role.permissions,
      },
    });
  },
);

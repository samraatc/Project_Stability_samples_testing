import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { PERMISSIONS } from '../../constants/permissions';
import { parseQuery } from '../../utils/query';
import { userService } from './user.service';
import {
  createUserSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserInput,
  type ResetPasswordInput,
  type UpdateUserInput,
} from './user.validation';
import type { RequestMeta } from '../auth/auth.types';

export const usersRouter = Router();

usersRouter.use(authenticate);

function meta(req: Request): RequestMeta {
  return { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' };
}

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List users (paginated; search, role, and status filters)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated users }
 *   post:
 *     summary: Create a user
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: User created }
 *       409: { description: Email already in use }
 */
usersRouter.get(
  '/',
  requirePermission(PERMISSIONS.USERS_READ),
  async (req: Request, res: Response) => {
    const query = parseQuery(listUsersQuerySchema, req.query);
    res.json({ success: true, data: await userService.list(query) });
  },
);

usersRouter.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate(createUserSchema),
  async (req: Request, res: Response) => {
    const created = await userService.create(req.body as CreateUserInput, req.user!, meta(req));
    res.status(201).json({ success: true, data: created });
  },
);

/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     summary: Update name, role, or status (role/deactivation revoke sessions)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated user }
 *   delete:
 *     summary: Soft-delete a user
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User deleted }
 */
usersRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(updateUserSchema),
  async (req: Request, res: Response) => {
    const updated = await userService.update(
      req.params.id as string,
      req.body as UpdateUserInput,
      req.user!,
      meta(req),
    );
    res.json({ success: true, data: updated });
  },
);

/**
 * @openapi
 * /users/{id}/reset-password:
 *   patch:
 *     summary: Admin resets a user's password (revokes all sessions)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Password reset successfully }
 */
usersRouter.patch(
  '/:id/reset-password',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(resetPasswordSchema),
  async (req: Request, res: Response) => {
    await userService.resetPassword(
      req.params.id as string,
      req.body as ResetPasswordInput,
      req.user!,
      meta(req),
    );
    res.json({ success: true, message: 'Password reset successfully' });
  },
);

usersRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS_DELETE),
  async (req: Request, res: Response) => {
    await userService.softDelete(req.params.id as string, req.user!, meta(req));
    res.json({ success: true, message: 'User deleted' });
  },
);

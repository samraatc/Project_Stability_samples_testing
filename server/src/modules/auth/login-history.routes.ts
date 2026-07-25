import { Router } from 'express';
import type { Request, Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import { escapeRegex, paginated, paginationSchema, parseQuery } from '../../utils/query';
import { LoginHistoryModel, type ILoginHistory } from './login-history.model';

export const loginHistoryRouter = Router();

const listLoginHistoryQuerySchema = paginationSchema.extend({
  email: z.string().trim().max(200).optional(),
  success: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

/**
 * @openapi
 * /login-history:
 *   get:
 *     summary: List login attempts (paginated; email and outcome filters)
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated login attempts }
 */
loginHistoryRouter.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.LOGIN_HISTORY_READ),
  async (req: Request, res: Response) => {
    const query = parseQuery(listLoginHistoryQuerySchema, req.query);

    const filter: FilterQuery<ILoginHistory> = {};
    if (query.email) filter.email = new RegExp(escapeRegex(query.email), 'i');
    if (query.success !== undefined) filter.success = query.success;

    const [items, total] = await Promise.all([
      LoginHistoryModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      LoginHistoryModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: paginated(
        items.map((entry) => ({
          id: entry._id.toString(),
          email: entry.email,
          success: entry.success,
          reason: entry.reason,
          ip: entry.ip,
          userAgent: entry.userAgent,
          createdAt: entry.createdAt,
        })),
        total,
        query.page,
        query.limit,
      ),
    });
  },
);

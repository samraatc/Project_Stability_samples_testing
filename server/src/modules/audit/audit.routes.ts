import { Router } from 'express';
import type { Request, Response } from 'express';
import { Types, type FilterQuery } from 'mongoose';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import { paginated, paginationSchema, parseQuery } from '../../utils/query';
import { AuditLogModel, type IAuditLog } from './audit-log.model';

export const auditRouter = Router();

const listAuditQuerySchema = paginationSchema.extend({
  action: z.string().trim().optional(),
  actorId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

/**
 * @openapi
 * /audit-logs:
 *   get:
 *     summary: List audit log entries (paginated; action, actor, and date filters)
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated audit entries }
 */
auditRouter.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.AUDIT_LOGS_READ),
  async (req: Request, res: Response) => {
    const query = parseQuery(listAuditQuerySchema, req.query);

    const filter: FilterQuery<IAuditLog> = {};
    if (query.action) filter.action = query.action;
    if (query.actorId) filter.actor = new Types.ObjectId(query.actorId);
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate<{ actor: { email: string } | null }>('actor', 'email')
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: paginated(
        items.map((entry) => ({
          id: entry._id.toString(),
          actorEmail: entry.actor?.email ?? null,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          details: entry.details,
          ip: entry.ip,
          createdAt: entry.createdAt,
        })),
        total,
        query.page,
        query.limit,
      ),
    });
  },
);

import type { Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { escapeRegex, paginationSchema } from './query';
import { recordAudit } from '../modules/audit/audit.service';

export const listQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(200).optional(),
  archived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/** Standard filter for soft-deleted, archivable entities. */
export function baseListFilter(query: ListQuery, searchFields: string[]): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    isDeleted: false,
    isArchived: query.archived ?? false,
  };
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = searchFields.map((field) => ({ [field]: rx }));
  }
  return filter;
}

export function actorIdOf(req: Request): Types.ObjectId {
  return new Types.ObjectId(req.user!.id);
}

export function auditFrom(
  req: Request,
  action: string,
  resource: string,
  resourceId: string,
  details?: Record<string, unknown>,
): void {
  recordAudit({
    actor: actorIdOf(req),
    action,
    resource,
    resourceId,
    details,
    ip: req.ip ?? '',
    userAgent: req.get('user-agent') ?? '',
  });
}

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

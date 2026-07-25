import type { Types } from 'mongoose';
import { AuditLogModel } from './audit-log.model';
import { logger } from '../../utils/logger';

export interface AuditEntry {
  actor: Types.ObjectId | null;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export const AUDIT_ACTIONS = {
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_PASSWORD_CHANGE: 'auth.password.change',
  AUTH_PASSWORD_RESET_REQUEST: 'auth.password.reset-request',
  AUTH_PASSWORD_RESET: 'auth.password.reset',
  AUTH_TOKEN_REUSE_DETECTED: 'auth.token.reuse-detected',
  USER_CREATE: 'users.create',
  USER_UPDATE: 'users.update',
  USER_DELETE: 'users.delete',
  USER_PASSWORD_RESET: 'users.password.reset',
  ROLE_UPDATE: 'roles.update',
  SETTINGS_UPDATE: 'settings.update',
} as const;

/**
 * Fire-and-forget: audit writes must never fail the business operation,
 * but failures are logged for investigation.
 */
export function recordAudit(entry: AuditEntry): void {
  void AuditLogModel.create({
    actor: entry.actor,
    action: entry.action,
    resource: entry.resource,
    resourceId: entry.resourceId ?? null,
    details: entry.details ?? null,
    ip: entry.ip ?? '',
    userAgent: entry.userAgent ?? '',
  }).catch((error: unknown) => {
    logger.error('Failed to write audit log', {
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

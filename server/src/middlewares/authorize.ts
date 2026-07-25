import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';

/** RBAC guard: the authenticated user must hold one of the given roles. */
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to perform this action', 403);
    }
    next();
  };
}

/** PBAC guard: the authenticated user must hold every listed permission. */
export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const granted = new Set(req.user.permissions);
    const missing = permissions.filter((p) => !granted.has(p));
    if (missing.length > 0) {
      throw new AppError('You do not have permission to perform this action', 403);
    }
    next();
  };
}

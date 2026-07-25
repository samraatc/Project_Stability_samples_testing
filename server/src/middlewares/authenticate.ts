import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/app-error';
import { verifyAccessToken } from '../utils/tokens';
import { userRepository } from '../modules/users/user.repository';
import { toAuthUser } from '../modules/auth/auth.service';

/**
 * Verifies the Bearer access token and loads the user fresh from the
 * database so deactivation, deletion, and role changes apply immediately.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }

  let payload;
  try {
    payload = verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    throw new AppError('Invalid or expired access token', 401);
  }

  const user = await userRepository.findByIdWithRole(payload.sub);
  if (!user || user.status !== 'active') {
    throw new AppError('Invalid or expired access token', 401);
  }

  // Tokens issued before the last password change are no longer valid.
  if (user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > payload.iat) {
    throw new AppError('Session expired. Please log in again.', 401);
  }

  req.user = toAuthUser(user);
  next();
}

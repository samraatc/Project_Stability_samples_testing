import type { Response } from 'express';
import { isProduction } from '../config/env';

export const REFRESH_COOKIE_NAME = 'esms_refresh';

/** Refresh token is scoped to the auth endpoints only. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: REFRESH_COOKIE_PATH,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });
}

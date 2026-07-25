import type { Request, Response } from 'express';
import { authService } from './auth.service';
import { REFRESH_COOKIE_NAME, clearRefreshCookie, setRefreshCookie } from '../../utils/cookies';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from './auth.validation';
import type { RequestMeta } from './auth.types';

function meta(req: Request): RequestMeta {
  return { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' };
}

function refreshCookieOf(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
}

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    const { email, password, rememberMe } = req.body as LoginInput;
    const result = await authService.login(email, password, rememberMe, meta(req));

    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res.status(200).json({
      success: true,
      data: { accessToken: result.accessToken, user: result.user },
    });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const token = refreshCookieOf(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const result = await authService.refresh(token, meta(req));

    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
    res.status(200).json({
      success: true,
      data: { accessToken: result.accessToken, user: result.user },
    });
  },

  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(refreshCookieOf(req), meta(req));
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: 'Logged out' });
  },

  async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({ success: true, data: req.user });
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    const { firstName, lastName, email } = req.body as any;
    const user = await authService.updateProfile(
      req.user!.id,
      { firstName, lastName, email },
      meta(req),
    );
    res.status(200).json({
      success: true,
      data: user,
      message: 'Profile updated successfully',
    });
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    // authenticate middleware guarantees req.user
    await authService.changePassword(req.user!.id, currentPassword, newPassword, meta(req));
    clearRefreshCookie(res);
    res.status(200).json({
      success: true,
      message: 'Password changed. Please log in again.',
    });
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body as ForgotPasswordInput;
    await authService.forgotPassword(email, meta(req));
    // Identical response whether or not the account exists.
    res.status(200).json({
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
    });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, newPassword } = req.body as ResetPasswordInput;
    await authService.resetPassword(token, newPassword, meta(req));
    res.status(200).json({
      success: true,
      message: 'Password reset. Please log in with your new password.',
    });
  },
};

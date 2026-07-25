import { AppError } from '../../utils/app-error';
import { hashPassword, verifyPassword } from '../../utils/password';
import { generateOpaqueToken, hashToken, signAccessToken } from '../../utils/tokens';
import { env } from '../../config/env';
import { userRepository, type UserWithRole } from '../users/user.repository';
import { refreshTokenRepository } from './refresh-token.repository';
import { loginHistoryRepository } from './login-history.repository';
import { AUDIT_ACTIONS, recordAudit } from '../audit/audit.service';
import { mailService } from '../../services/mail.service';
import type { AuthUser, LoginResult, RequestMeta } from './auth.types';

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export function toAuthUser(user: UserWithRole): AuthUser {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role.name,
    permissions: user.role.permissions,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

function refreshExpiry(rememberMe: boolean): Date {
  const days = rememberMe ? env.REFRESH_TOKEN_REMEMBER_TTL_DAYS : env.REFRESH_TOKEN_TTL_DAYS;
  return new Date(Date.now() + days * DAY_MS);
}

async function issueSession(
  user: UserWithRole,
  rememberMe: boolean,
  meta: RequestMeta,
): Promise<LoginResult> {
  const refreshToken = generateOpaqueToken();
  const refreshExpiresAt = refreshExpiry(rememberMe);

  await refreshTokenRepository.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt,
    rememberMe,
    createdByIp: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    user: toAuthUser(user),
    accessToken: signAccessToken(user._id.toString()),
    refreshToken,
    refreshExpiresAt,
  };
}

export const authService = {
  async login(
    email: string,
    password: string,
    rememberMe: boolean,
    meta: RequestMeta,
  ): Promise<LoginResult> {
    const user = await userRepository.findByEmailWithRole(email);

    if (!user) {
      await loginHistoryRepository.record({
        email,
        success: false,
        reason: 'unknown_email',
        ...meta,
      });
      throw new AppError('Invalid email or password', 401);
    }

    const history = (success: boolean, reason: string) =>
      loginHistoryRepository.record({ user: user._id, email, success, reason, ...meta });

    if (user.status !== 'active') {
      await history(false, 'account_inactive');
      throw new AppError('Account is inactive. Contact an administrator.', 403);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await history(false, 'account_locked');
      throw new AppError(`Account is locked. Try again in ${minutes} minute(s).`, 423);
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0;
        await user.save();
        await history(false, 'account_locked');
        throw new AppError(
          'Account locked due to repeated failed logins. Try again in 15 minutes.',
          423,
        );
      }
      await user.save();
      await history(false, 'invalid_credentials');
      throw new AppError('Invalid email or password', 401);
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const result = await issueSession(user, rememberMe, meta);

    await history(true, 'ok');
    recordAudit({
      actor: user._id,
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      resource: 'auth',
      ...meta,
    });

    return result;
  },

  async refresh(rawToken: string, meta: RequestMeta): Promise<LoginResult> {
    const stored = await refreshTokenRepository.findByTokenHash(hashToken(rawToken));

    if (!stored) {
      throw new AppError('Invalid refresh token', 401);
    }

    if (stored.revokedAt) {
      // A revoked token being replayed indicates theft; kill every session.
      await refreshTokenRepository.revokeAllForUser(stored.user);
      recordAudit({
        actor: stored.user,
        action: AUDIT_ACTIONS.AUTH_TOKEN_REUSE_DETECTED,
        resource: 'auth',
        ...meta,
      });
      throw new AppError('Invalid refresh token', 401);
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new AppError('Refresh token expired', 401);
    }

    const user = await userRepository.findByIdWithRole(stored.user);
    if (!user || user.status !== 'active') {
      throw new AppError('Invalid refresh token', 401);
    }

    const result = await issueSession(user, stored.rememberMe, meta);

    stored.revokedAt = new Date();
    stored.replacedByTokenHash = hashToken(result.refreshToken);
    await stored.save();

    return result;
  },

  async logout(rawToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!rawToken) return;
    const stored = await refreshTokenRepository.findByTokenHash(hashToken(rawToken));
    if (stored && !stored.revokedAt) {
      stored.revokedAt = new Date();
      await stored.save();
      recordAudit({
        actor: stored.user,
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
        resource: 'auth',
        ...meta,
      });
    }
  },

  async getMe(userId: string): Promise<AuthUser> {
    const user = await userRepository.findByIdWithRole(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return toAuthUser(user);
  },

  async updateProfile(
    userId: string,
    data: { firstName: string; lastName: string; email: string },
    meta: RequestMeta,
  ): Promise<AuthUser> {
    const user = await userRepository.findByIdWithRole(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (data.email !== user.email) {
      const existing = await userRepository.findByEmail(data.email);
      if (existing && existing._id.toString() !== userId) {
        throw new AppError('Email is already in use by another account', 400);
      }
    }

    user.firstName = data.firstName;
    user.lastName = data.lastName;
    user.email = data.email;
    await user.save();

    recordAudit({
      actor: user._id,
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      resource: 'auth',
      ...meta,
    });

    return toAuthUser(user);
  },

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await userRepository.findByIdWithRole(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const currentOk = await verifyPassword(currentPassword, user.passwordHash);
    if (!currentOk) {
      throw new AppError('Current password is incorrect', 401);
    }
    if (currentPassword === newPassword) {
      throw new AppError('New password must be different from the current password', 400);
    }

    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await user.save();

    // Invalidate every session; the user must log in again elsewhere.
    await refreshTokenRepository.revokeAllForUser(user._id);

    recordAudit({
      actor: user._id,
      action: AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE,
      resource: 'auth',
      ...meta,
    });
  },

  /**
   * Always resolves successfully so the endpoint never reveals whether an
   * email is registered. Returns the raw token for internal use (tests);
   * the controller must not expose it.
   */
  async forgotPassword(email: string, meta: RequestMeta): Promise<string | null> {
    const user = await userRepository.findByEmailWithRole(email);
    if (!user || user.status !== 'active') {
      return null;
    }

    const rawToken = generateOpaqueToken();
    user.resetPasswordTokenHash = hashToken(rawToken);
    user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    await mailService.sendPasswordResetEmail(
      user.email,
      `${env.CLIENT_URL}/reset-password?token=${rawToken}`,
    );

    recordAudit({
      actor: user._id,
      action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_REQUEST,
      resource: 'auth',
      ...meta,
    });

    return rawToken;
  },

  async resetPassword(rawToken: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const user = await userRepository.findByResetTokenHash(hashToken(rawToken));
    if (!user) {
      throw new AppError('Reset link is invalid or has expired', 400);
    }

    user.passwordHash = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    await refreshTokenRepository.revokeAllForUser(user._id);

    recordAudit({
      actor: user._id,
      action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET,
      resource: 'auth',
      ...meta,
    });
  },
};

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isTest } from '../../config/env';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authController } from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.validation';

export const authRouter = Router();

/** Stricter limit for credential endpoints (brute-force mitigation). */
const authLimiter = isTest
  ? []
  : [
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { success: false, message: 'Too many attempts. Try again later.' },
      }),
    ];

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               rememberMe: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Access token in body; rotating refresh token set as an httpOnly cookie.
 *       401: { description: Invalid credentials }
 *       423: { description: Account locked }
 */
authRouter.post('/login', ...authLimiter, validate(loginSchema), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate the refresh token and obtain a new access token
 *     tags: [Auth]
 *     responses:
 *       200: { description: New access token and refresh cookie }
 *       401: { description: Missing, expired, or reused refresh token }
 */
authRouter.post('/refresh', authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke the current session
 *     tags: [Auth]
 *     responses:
 *       200: { description: Session revoked and cookie cleared }
 */
authRouter.post('/logout', authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Current authenticated user with role and permissions
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Authenticated user profile }
 *       401: { description: Not authenticated }
 */
authRouter.get('/me', authenticate, authController.me);

/**
 * @openapi
 * /auth/profile:
 *   put:
 *     summary: Update profile details (firstName, lastName, email)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile updated }
 *       400: { description: Email already in use }
 */
authRouter.put(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  authController.updateProfile,
);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     summary: Change the current user's password (revokes all sessions)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Password changed }
 *       401: { description: Current password incorrect }
 */
authRouter.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     tags: [Auth]
 *     responses:
 *       200: { description: Generic acknowledgement (does not reveal account existence) }
 */
authRouter.post(
  '/forgot-password',
  ...authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using an emailed token
 *     tags: [Auth]
 *     responses:
 *       200: { description: Password reset }
 *       400: { description: Invalid or expired token }
 */
authRouter.post(
  '/reset-password',
  ...authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

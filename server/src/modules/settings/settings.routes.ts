import { Router } from 'express';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { PERMISSIONS } from '../../constants/permissions';
import { settingsService, smtpSettingsSchema, type SmtpSettings } from './settings.service';

export const settingsRouter = Router();

settingsRouter.use(authenticate, requirePermission(PERMISSIONS.SETTINGS_MANAGE));

/**
 * @openapi
 * /settings/smtp:
 *   get:
 *     summary: SMTP configuration (password masked)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current SMTP settings }
 *   put:
 *     summary: Update SMTP configuration
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated SMTP settings (password masked) }
 */
settingsRouter.get('/smtp', async (_req: Request, res: Response) => {
  res.json({ success: true, data: await settingsService.getSmtpSettingsMasked() });
});

settingsRouter.put('/smtp', validate(smtpSettingsSchema), async (req: Request, res: Response) => {
  const updated = await settingsService.updateSmtpSettings(
    req.body as SmtpSettings,
    new Types.ObjectId(req.user!.id),
    { ip: req.ip ?? '', userAgent: req.get('user-agent') ?? '' },
  );
  res.json({ success: true, data: updated });
});

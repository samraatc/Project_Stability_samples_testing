import type { Types } from 'mongoose';
import { z } from 'zod';
import { SystemSettingsModel } from './system-settings.model';
import { AUDIT_ACTIONS, recordAudit } from '../audit/audit.service';
import type { RequestMeta } from '../auth/auth.types';

export const SMTP_SETTINGS_KEY = 'smtp';
const PASSWORD_MASK = '********';

export const smtpSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    host: z.string().trim().default(''),
    port: z.coerce.number().int().min(1).max(65535).default(587),
    secure: z.boolean().default(false),
    username: z.string().trim().default(''),
    password: z.string().default(''),
    fromEmail: z.union([z.literal(''), z.string().email()]).default(''),
    fromName: z.string().trim().default('ESMS'),
  })
  .superRefine((value, ctx) => {
    if (value.enabled) {
      if (!value.host) {
        ctx.addIssue({ code: 'custom', path: ['host'], message: 'Host is required when enabled' });
      }
      if (!value.fromEmail) {
        ctx.addIssue({
          code: 'custom',
          path: ['fromEmail'],
          message: 'From email is required when enabled',
        });
      }
    }
  });

export type SmtpSettings = z.infer<typeof smtpSettingsSchema>;

const DEFAULT_SMTP: SmtpSettings = smtpSettingsSchema.parse({});

export const settingsService = {
  /** Unmasked - internal use (mailer) only. Never return from the API. */
  async getSmtpSettings(): Promise<SmtpSettings> {
    const doc = await SystemSettingsModel.findOne({ key: SMTP_SETTINGS_KEY }).lean();
    if (!doc) return DEFAULT_SMTP;
    const parsed = smtpSettingsSchema.safeParse(doc.value);
    return parsed.success ? parsed.data : DEFAULT_SMTP;
  },

  async getSmtpSettingsMasked(): Promise<SmtpSettings> {
    const settings = await this.getSmtpSettings();
    return { ...settings, password: settings.password ? PASSWORD_MASK : '' };
  },

  async updateSmtpSettings(
    input: SmtpSettings,
    actorId: Types.ObjectId,
    meta: RequestMeta,
  ): Promise<SmtpSettings> {
    // The mask means "keep the stored password".
    if (input.password === PASSWORD_MASK) {
      const current = await this.getSmtpSettings();
      input = { ...input, password: current.password };
    }

    await SystemSettingsModel.findOneAndUpdate(
      { key: SMTP_SETTINGS_KEY },
      { $set: { value: input, updatedBy: actorId } },
      { upsert: true },
    );

    recordAudit({
      actor: actorId,
      action: AUDIT_ACTIONS.SETTINGS_UPDATE,
      resource: 'settings',
      resourceId: SMTP_SETTINGS_KEY,
      details: { enabled: input.enabled, host: input.host, port: input.port },
      ...meta,
    });

    return { ...input, password: input.password ? PASSWORD_MASK : '' };
  },
};

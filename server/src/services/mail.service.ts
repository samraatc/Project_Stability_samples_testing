import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { settingsService } from '../modules/settings/settings.service';

interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends via the SMTP configuration managed in Super Admin settings.
 * Falls back to logging when SMTP is disabled or unconfigured so
 * dependent flows (password reset) keep working in every environment.
 */
async function send(message: MailMessage): Promise<void> {
  const smtp = await settingsService.getSmtpSettings();

  if (!smtp.enabled || !smtp.host) {
    logger.info('Email not sent (SMTP disabled) - logging instead', message);
    return;
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
  });

  try {
    await transport.sendMail({
      from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    logger.info('Email sent', { to: message.to, subject: message.subject });
  } catch (error) {
    logger.error('Email delivery failed', {
      to: message.to,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const mailService = {
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await send({
      to,
      subject: 'ESMS password reset',
      text:
        `A password reset was requested for your ESMS account.\n\n` +
        `Reset link (valid for 30 minutes): ${resetUrl}\n\n` +
        `If you did not request this, you can ignore this email.`,
    }).catch(() => {
      // Reset flow must not fail because of mail transport issues;
      // the error is already logged above.
    });
  },
};

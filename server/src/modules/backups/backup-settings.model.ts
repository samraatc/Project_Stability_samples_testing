import { Schema, model } from 'mongoose';

export interface IBackupSettings {
  enabled: boolean;
  schedule: 'daily' | 'weekly' | 'monthly' | 'custom';
  cronExpression: string;
  updatedAt: Date;
}

const backupSettingsSchema = new Schema<IBackupSettings>(
  {
    enabled: { type: Boolean, required: true, default: false },
    schedule: {
      type: String,
      required: true,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      default: 'daily',
    },
    cronExpression: { type: String, required: true, default: '0 0 * * *' },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const BackupSettingsModel = model<IBackupSettings>('BackupSettings', backupSettingsSchema);

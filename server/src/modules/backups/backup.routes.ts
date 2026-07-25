import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../../middlewares/authenticate';
import { requirePermission } from '../../middlewares/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import { auditFrom, actorIdOf } from '../../utils/crud';
import { logger } from '../../utils/logger';
import { BackupModel } from './backup.model';
import { BackupSettingsModel } from './backup-settings.model';
import {
  getBackupDirectory,
  runBackupProcess,
  runRestoreProcess,
  rescheduleBackupJob,
} from './backup.scheduler';
import { AppError } from '../../utils/app-error';

export const backupsRouter = Router();

backupsRouter.use(authenticate, requirePermission(PERMISSIONS.BACKUPS_MANAGE));

const updateSettingsSchema = z.object({
  enabled: z.boolean(),
  schedule: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  cronExpression: z.string().trim().min(1),
});

/** GET /backups - List previous backups metadata */
backupsRouter.get('/', async (_req: Request, res: Response) => {
  const items = await BackupModel.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate<{ createdBy: { email: string } | null }>('createdBy', 'email')
    .lean();

  res.json({
    success: true,
    data: items.map((b) => ({
      id: b._id.toString(),
      name: b.name,
      sizeBytes: b.sizeBytes,
      collections: b.collections,
      createdBy: b.createdBy?.email ?? null,
      createdAt: b.createdAt,
    })),
  });
});

/** GET /backups/settings - Retrieve backup scheduler settings */
backupsRouter.get('/settings', async (_req: Request, res: Response) => {
  let settings = await BackupSettingsModel.findOne();
  if (!settings) {
    settings = await BackupSettingsModel.create({
      enabled: false,
      schedule: 'daily',
      cronExpression: '0 0 * * *',
    });
  }

  res.json({
    success: true,
    data: {
      enabled: settings.enabled,
      schedule: settings.schedule,
      cronExpression: settings.cronExpression,
    },
  });
});

/** POST /backups/settings - Update backup scheduler settings */
backupsRouter.post('/settings', async (req: Request, res: Response) => {
  const body = updateSettingsSchema.parse(req.body);

  let settings = await BackupSettingsModel.findOne();
  if (!settings) {
    settings = new BackupSettingsModel();
  }

  settings.enabled = body.enabled;
  settings.schedule = body.schedule;
  settings.cronExpression = body.cronExpression;
  await settings.save();

  // Reschedule the auto backup job
  await rescheduleBackupJob();

  auditFrom(req, 'backups.updateSettings', 'backupSettings', settings._id.toString(), {
    enabled: settings.enabled,
    schedule: settings.schedule,
    cronExpression: settings.cronExpression,
  });

  res.json({
    success: true,
    data: {
      enabled: settings.enabled,
      schedule: settings.schedule,
      cronExpression: settings.cronExpression,
    },
  });
});

/** POST /backups - Create a backup manually */
backupsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const actorId = actorIdOf(req);
    const filename = await runBackupProcess(actorId.toString());

    // Add audit log details inside runBackupProcess or here
    auditFrom(req, 'backups.create', 'backups', filename, {
      manual: true,
    });

    const filePath = path.join(getBackupDirectory(), filename);
    res.download(filePath, filename);
  } catch (err: any) {
    logger.error('Failed to create manual backup', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /backups/restore-file - Restore database from uploaded JSON payload */
backupsRouter.post('/restore-file', async (req: Request, res: Response) => {
  try {
    const { backupData } = req.body;
    if (!backupData) {
      throw new AppError('No backup JSON data provided', 400);
    }

    const result = await runRestoreProcess(backupData);

    auditFrom(req, 'backups.restoreFile', 'backups', 'local-upload', {
      restoredCollections: result.restoredCollections,
      totalDocs: result.totalDocs,
    });

    res.json({
      success: true,
      data: result,
      message: `Successfully restored ${result.totalDocs} documents across ${result.restoredCollections} collections.`,
    });
  } catch (err: any) {
    logger.error('Failed to restore database from backup file', { error: err.message });
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

/** GET /backups/:id/download - Download a backup file */
backupsRouter.get('/:id/download', async (req: Request, res: Response) => {
  const backup = await BackupModel.findById(req.params.id);
  if (!backup) {
    throw new AppError('Backup not found', 404);
  }

  const filePath = path.join(getBackupDirectory(), backup.name);
  if (!fs.existsSync(filePath)) {
    throw new AppError('Backup file not found on disk', 404);
  }

  res.download(filePath, backup.name);
});

/** DELETE /backups/:id - Delete a backup record and its file */
backupsRouter.delete('/:id', async (req: Request, res: Response) => {
  const backup = await BackupModel.findById(req.params.id);
  if (!backup) {
    throw new AppError('Backup not found', 404);
  }

  const filePath = path.join(getBackupDirectory(), backup.name);

  // Attempt to delete physical file from disk
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (err: any) {
    logger.warn('Failed to delete backup file from disk', { path: filePath, error: err.message });
  }

  // Delete DB record
  await BackupModel.findByIdAndDelete(req.params.id);

  auditFrom(req, 'backups.delete', 'backups', backup.name);
  logger.info('Backup deleted', { name: backup.name, id: req.params.id });

  res.json({
    success: true,
    message: 'Backup deleted successfully',
  });
});

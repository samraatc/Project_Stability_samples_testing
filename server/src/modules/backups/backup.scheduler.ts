import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import { BackupModel } from './backup.model';
import { BackupSettingsModel } from './backup-settings.model';
import { logger } from '../../utils/logger';

let activeBackupTask: cron.ScheduledTask | null = null;

// Helper to resolve the storage directory on the server
export const getBackupDirectory = () => {
  const dir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Map friendly schedules to standard cron expressions
export const getCronExpressionForSchedule = (schedule: string, customExpression?: string) => {
  switch (schedule) {
    case 'daily':
      return '0 0 * * *'; // Every day at midnight
    case 'weekly':
      return '0 0 * * 0'; // Every Sunday at midnight
    case 'monthly':
      return '0 0 1 * *'; // First day of every month at midnight
    case 'custom':
      return customExpression || '0 0 * * *';
    default:
      return '0 0 * * *';
  }
};

// core backup generation logic
export async function runBackupProcess(createdByUserId: string | null): Promise<string> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection unavailable');
  }

  const started = Date.now();
  const collections = await db.listCollections().toArray();
  const dump: Record<string, unknown[]> = {};
  const summary: { name: string; count: number }[] = [];

  for (const info of collections) {
    if (info.name.startsWith('system.')) continue;
    if (info.name === 'sections') continue;
    const docs = await db.collection(info.name).find({}).toArray();
    dump[info.name] = docs;
    summary.push({ name: info.name, count: docs.length });
  }

  const payload = EJSON.stringify(
    {
      format: 'esms-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      database: db.databaseName,
      collections: dump,
    },
    { relaxed: false },
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `esms-backup-${timestamp}${createdByUserId ? '' : '-auto'}.json`;
  const backupDir = getBackupDirectory();
  const filePath = path.join(backupDir, filename);

  // Write payload to local disk on server
  await fs.promises.writeFile(filePath, payload, 'utf8');
  const sizeBytes = Buffer.byteLength(payload, 'utf8');

  // Register in DB metadata
  await BackupModel.create({
    name: filename,
    sizeBytes,
    collections: summary,
    createdBy: createdByUserId ? new mongoose.Types.ObjectId(createdByUserId) : null,
  });

  logger.info('Backup generated successfully', {
    name: filename,
    sizeBytes,
    collections: summary.length,
    durationMs: Date.now() - started,
    automated: !createdByUserId,
  });

  return filename;
}

// Database restoration from JSON backup file payload
export async function runRestoreProcess(
  backupJsonData: unknown,
): Promise<{ restoredCollections: number; totalDocs: number }> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection unavailable');
  }

  let parsed: { collections?: Record<string, any[]> } = {};

  if (typeof backupJsonData === 'string') {
    parsed = EJSON.parse(backupJsonData) as any;
  } else if (backupJsonData && typeof backupJsonData === 'object') {
    // Convert object to EJSON string and parse back to restore BSON types
    const raw = JSON.stringify(backupJsonData);
    parsed = EJSON.parse(raw) as any;
  }

  if (!parsed || typeof parsed.collections !== 'object') {
    throw new Error('Invalid backup file format: missing or invalid "collections" section.');
  }

  let restoredCollections = 0;
  let totalDocs = 0;

  for (const [colName, docs] of Object.entries(parsed.collections)) {
    if (!Array.isArray(docs) || docs.length === 0) continue;
    if (colName.startsWith('system.')) continue;

    const ops = docs.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }));

    await db.collection(colName).bulkWrite(ops);
    restoredCollections++;
    totalDocs += docs.length;
  }

  logger.info('Database restored from local backup JSON', {
    restoredCollections,
    totalDocs,
  });

  return { restoredCollections, totalDocs };
}

// Reschedules the active cron job using current settings
export async function rescheduleBackupJob() {
  // Stop existing cron job
  if (activeBackupTask) {
    activeBackupTask.stop();
    activeBackupTask = null;
  }

  // Fetch settings or create defaults
  let settings = await BackupSettingsModel.findOne();
  if (!settings) {
    settings = await BackupSettingsModel.create({
      enabled: false,
      schedule: 'daily',
      cronExpression: '0 0 * * *',
    });
  }

  if (!settings.enabled) {
    logger.info('Auto backup scheduler is disabled');
    return;
  }

  const expression = getCronExpressionForSchedule(settings.schedule, settings.cronExpression);
  if (!cron.validate(expression)) {
    logger.error('Invalid cron expression for auto backup', { expression });
    return;
  }

  logger.info('Scheduling auto backup job', { expression, schedule: settings.schedule });

  activeBackupTask = cron.schedule(expression, async () => {
    logger.info('Starting automated background backup...');
    try {
      await runBackupProcess(null);
    } catch (err: any) {
      logger.error('Automated background backup failed', { error: err.message });
    }
  });
}

// Initializer called during server startup
export async function initBackupScheduler() {
  try {
    await rescheduleBackupJob();
  } catch (err: any) {
    logger.error('Failed to initialize backup scheduler', { error: err.message });
  }
}

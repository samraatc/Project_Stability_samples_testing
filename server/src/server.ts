import http from 'node:http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { logger } from './utils/logger';

import { initBackupScheduler } from './modules/backups/backup.scheduler';

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    await initBackupScheduler();
  } catch (error) {
    logger.error('Failed to connect to MongoDB - shutting down', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  const server = http.createServer(createApp());

  server.listen(env.PORT, () => {
    logger.info(`ESMS API listening on port ${env.PORT}`, { env: env.NODE_ENV });
    logger.info(`Swagger docs available at http://localhost:${env.PORT}/api/docs`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received - shutting down gracefully`);
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void bootstrap();

import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { seedDemoUsers, seedRoles, seedSuperAdmin } from '../modules/auth/seed';

/**
 * Idempotent database seed:
 *  1. The 7 system roles with their permission catalogs (upserted).
 *  2. The initial super admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
 *  3. Optional demo users, one per role, when SEED_DEMO_USERS=true
 *     (SEED_DEMO_PASSWORD; development only).
 *
 * Run with: npm run seed --workspace server
 */
async function main(): Promise<void> {
  await connectDatabase();

  await seedRoles();
  await seedSuperAdmin(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
  logger.info('Super admin login', { email: env.SEED_ADMIN_EMAIL });

  if (env.SEED_DEMO_USERS === 'true') {
    await seedDemoUsers(env.SEED_DEMO_PASSWORD);
  }

  await disconnectDatabase();
  logger.info('Seed complete');
}

main().catch((error: unknown) => {
  logger.error('Seed failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

import { connectDatabase, disconnectDatabase } from '../config/db';
import '../modules/roles/role.model';
import { UserModel } from '../modules/users/user.model';
import { env } from '../config/env';
import { seedSuperAdmin } from '../modules/auth/seed';
import { authService } from '../modules/auth/auth.service';

async function unlockAndTest() {
  await connectDatabase();
  console.log('Connected to MongoDB');

  await UserModel.updateOne(
    { email: env.SEED_ADMIN_EMAIL.toLowerCase() },
    { $set: { failedLoginAttempts: 0, lockedUntil: null, status: 'active' } }
  );
  console.log(`Unlocked user account: ${env.SEED_ADMIN_EMAIL}`);

  await seedSuperAdmin(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
  console.log(`Re-seeded super admin: ${env.SEED_ADMIN_EMAIL} with password from .env`);

  const result = await authService.login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD, false, {
    ip: '127.0.0.1',
    userAgent: 'test-script',
  });

  console.log('====================================================');
  console.log('🎉 AUTHENTICATION TEST PASSED!');
  console.log('   User Email:', result.user.email);
  console.log('   Role Name :', result.user.role);
  console.log('   JWT Access Token Generated:', result.accessToken ? 'YES' : 'NO');
  console.log('====================================================');

  await disconnectDatabase();
}

unlockAndTest().catch((err) => {
  console.error('❌ AUTHENTICATION TEST FAILED:', err);
  process.exit(1);
});

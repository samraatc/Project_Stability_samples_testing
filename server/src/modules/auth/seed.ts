import { ROLE_DEFINITIONS, ROLE_NAMES } from '../../constants/permissions';
import { roleRepository } from '../roles/role.repository';
import { userRepository } from '../users/user.repository';
import { UserModel } from '../users/user.model';
import { hashPassword } from '../../utils/password';
import { logger } from '../../utils/logger';

/** Idempotent: system role permissions are kept in sync with the code catalog. */
export async function seedRoles(): Promise<void> {
  for (const definition of ROLE_DEFINITIONS) {
    await roleRepository.upsertByName(definition.name, {
      description: definition.description,
      permissions: definition.permissions,
      isSystem: true,
    });
  }
  logger.info(`Seeded ${ROLE_DEFINITIONS.length} system roles`);
}

export async function seedSuperAdmin(email: string, password: string): Promise<void> {
  const role = await roleRepository.findByName(ROLE_NAMES.SUPER_ADMIN);
  if (!role) {
    throw new Error('super-admin role missing; run seedRoles first');
  }

  const passwordHash = await hashPassword(password);
  const normalizedEmail = email.toLowerCase();

  // 1. Look for user by email
  let existingUser = await UserModel.findOne({ email: normalizedEmail }).exec();

  // 2. If not found by email, look for existing super-admin account
  if (!existingUser) {
    existingUser = await UserModel.findOne({ role: role._id, isDeleted: false }).exec();
  }

  if (existingUser) {
    existingUser.email = normalizedEmail;
    existingUser.passwordHash = passwordHash;
    existingUser.status = 'active';
    existingUser.role = role._id;
    existingUser.isDeleted = false;
    await existingUser.save();
    logger.info('Super admin account updated with seed credentials', { email: normalizedEmail });
    return;
  }

  await UserModel.create({
    email: normalizedEmail,
    passwordHash,
    firstName: 'Super',
    lastName: 'Admin',
    role: role._id,
    status: 'active',
  });

  logger.info('Super admin account created with seed credentials', { email: normalizedEmail });
}

/**
 * Development/demo convenience: one user per non-super-admin role so every
 * permission set can be exercised. Never enable in production.
 */
export async function seedDemoUsers(password: string): Promise<void> {
  const demoUsers = [
    {
      email: 'administrator@esms.local',
      firstName: 'Ada',
      lastName: 'Admin',
      role: ROLE_NAMES.ADMINISTRATOR,
    },
    {
      email: 'qa.manager@esms.local',
      firstName: 'Quinn',
      lastName: 'Assurance',
      role: ROLE_NAMES.QA_MANAGER,
    },
    {
      email: 'qc.manager@esms.local',
      firstName: 'Casey',
      lastName: 'Control',
      role: ROLE_NAMES.QC_MANAGER,
    },
    {
      email: 'analyst@esms.local',
      firstName: 'Sam',
      lastName: 'Analyst',
      role: ROLE_NAMES.ANALYST,
    },
    {
      email: 'data.entry@esms.local',
      firstName: 'Devin',
      lastName: 'Entry',
      role: ROLE_NAMES.DATA_ENTRY,
    },
    { email: 'viewer@esms.local', firstName: 'Vera', lastName: 'Viewer', role: ROLE_NAMES.VIEWER },
  ];

  const passwordHash = await hashPassword(password);
  let created = 0;

  for (const demo of demoUsers) {
    const exists = await userRepository.findByEmailWithRole(demo.email);
    if (exists) continue;
    const role = await roleRepository.findByName(demo.role);
    if (!role) throw new Error(`Role ${demo.role} missing; run seedRoles first`);
    await UserModel.create({
      email: demo.email,
      passwordHash,
      firstName: demo.firstName,
      lastName: demo.lastName,
      role: role._id,
      status: 'active',
    });
    created += 1;
  }

  if (created > 0) {
    logger.warn(`Seeded ${created} demo user(s) - shared password, for development only`, {
      users: demoUsers.map((u) => u.email),
    });
  } else {
    logger.info('Demo users already exist - skipping');
  }
}

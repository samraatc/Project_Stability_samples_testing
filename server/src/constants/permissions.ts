/**
 * Central permission catalog (PBAC). Roles reference these keys; the
 * catalog grows as domain modules are added in later phases.
 */
export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
  AUDIT_LOGS_READ: 'audit-logs:read',
  LOGIN_HISTORY_READ: 'login-history:read',
  SETTINGS_MANAGE: 'settings:manage',
  BACKUPS_MANAGE: 'backups:manage',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_MANAGE: 'products:manage',
  SECTIONS_READ: 'sections:read',
  SECTIONS_MANAGE: 'sections:manage',
  BATCHES_READ: 'batches:read',
  BATCHES_MANAGE: 'batches:manage',
  SAMPLES_READ: 'samples:read',
  SAMPLES_MANAGE: 'samples:manage',
  CATEGORIES_READ: 'categories:read',
  CATEGORIES_MANAGE: 'categories:manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const ROLE_NAMES = {
  SUPER_ADMIN: 'super-admin',
  ADMINISTRATOR: 'administrator',
  QA_MANAGER: 'qa-manager',
  QC_MANAGER: 'qc-manager',
  ANALYST: 'analyst',
  DATA_ENTRY: 'data-entry',
  VIEWER: 'viewer',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

export interface RoleDefinition {
  name: RoleName;
  description: string;
  permissions: PermissionKey[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: ROLE_NAMES.SUPER_ADMIN,
    description: 'Full system access including platform configuration',
    permissions: ALL_PERMISSIONS,
  },
  {
    name: ROLE_NAMES.ADMINISTRATOR,
    description: 'Manages users, master data, and operational reports',
    permissions: [
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_CREATE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.AUDIT_LOGS_READ,
      PERMISSIONS.LOGIN_HISTORY_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_MANAGE,
      PERMISSIONS.SECTIONS_READ,
      PERMISSIONS.SECTIONS_MANAGE,
      PERMISSIONS.BATCHES_READ,
      PERMISSIONS.BATCHES_MANAGE,
      PERMISSIONS.SAMPLES_READ,
      PERMISSIONS.SAMPLES_MANAGE,
      PERMISSIONS.CATEGORIES_READ,
      PERMISSIONS.CATEGORIES_MANAGE,
    ],
  },
  {
    name: ROLE_NAMES.QA_MANAGER,
    description: 'Reviews, approves, and schedules stability activities',
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.SECTIONS_READ,
      PERMISSIONS.BATCHES_READ,
      PERMISSIONS.SAMPLES_READ,
      PERMISSIONS.CATEGORIES_READ,
    ],
  },
  {
    name: ROLE_NAMES.QC_MANAGER,
    description: 'Assigns tests and reviews laboratory results',
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.SECTIONS_READ,
      PERMISSIONS.BATCHES_READ,
      PERMISSIONS.SAMPLES_READ,
      PERMISSIONS.CATEGORIES_READ,
    ],
  },
  {
    name: ROLE_NAMES.ANALYST,
    description: 'Executes assigned tests and records results',
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.BATCHES_READ,
      PERMISSIONS.SAMPLES_READ,
      PERMISSIONS.CATEGORIES_READ,
    ],
  },
  {
    name: ROLE_NAMES.DATA_ENTRY,
    description: 'Enters products, batches, and samples',
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_MANAGE,
      PERMISSIONS.SECTIONS_READ,
      PERMISSIONS.BATCHES_READ,
      PERMISSIONS.BATCHES_MANAGE,
      PERMISSIONS.SAMPLES_READ,
      PERMISSIONS.SAMPLES_MANAGE,
      PERMISSIONS.CATEGORIES_READ,
      PERMISSIONS.CATEGORIES_MANAGE,
    ],
  },
  {
    name: ROLE_NAMES.VIEWER,
    description: 'Read-only access to dashboards and reports',
    permissions: [
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.SECTIONS_READ,
      PERMISSIONS.BATCHES_READ,
      PERMISSIONS.SAMPLES_READ,
      PERMISSIONS.CATEGORIES_READ,
    ],
  },
];

/** ICH-style stability pull points (months), including accelerated and long-term extended intervals. */
export const STABILITY_INTERVAL_MONTHS = [1, 2, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42, 48, 54, 60] as const;

export const DEFAULT_INTERVALS_BY_TYPE: Record<string, number[]> = {
  'long-term': [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  'intermediate': [3, 6, 9, 12],
  'accelerated': [1, 2, 3, 6],
};

export const STABILITY_TYPES = ['long-term', 'accelerated', 'intermediate'] as const;
export type StabilityType = (typeof STABILITY_TYPES)[number];

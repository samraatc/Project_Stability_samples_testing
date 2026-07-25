export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ManagedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: { id: string; name: string };
  status: 'active' | 'inactive';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RoleInfo {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

export interface RolesResponse {
  catalog: string[];
  roles: RoleInfo[];
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ip: string;
  createdAt: string;
}

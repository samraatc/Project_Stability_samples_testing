import { api } from '@/lib/api';
import type { AuditLogEntry, ManagedUser, Paginated, RolesResponse } from './types';

export interface CreateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  password: string;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  roleId?: string;
  status?: 'active' | 'inactive';
}

export async function fetchUsers(params: {
  page: number;
  search?: string;
  limit?: number;
}): Promise<Paginated<ManagedUser>> {
  const res = await api.get<{ data: Paginated<ManagedUser> }>('/users', {
    params: { page: params.page, limit: params.limit ?? 10, search: params.search || undefined },
  });
  return res.data.data;
}

export interface SystemHealthData {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  database: string;
}

export async function fetchSystemHealth(): Promise<SystemHealthData> {
  const res = await api.get<{ data: SystemHealthData }>('/health');
  return res.data.data;
}

export async function createUser(payload: CreateUserPayload): Promise<ManagedUser> {
  const res = await api.post<{ data: ManagedUser }>('/users', payload);
  return res.data.data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<ManagedUser> {
  const res = await api.patch<{ data: ManagedUser }>(`/users/${id}`, payload);
  return res.data.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  await api.patch(`/users/${id}/reset-password`, { newPassword });
}

export async function fetchRoles(): Promise<RolesResponse> {
  const res = await api.get<{ data: RolesResponse }>('/roles');
  return res.data.data;
}

export async function updateRolePermissions(id: string, permissions: string[]): Promise<void> {
  await api.put(`/roles/${id}/permissions`, { permissions });
}

export async function fetchAuditLogs(params: { page: number }): Promise<Paginated<AuditLogEntry>> {
  const res = await api.get<{ data: Paginated<AuditLogEntry> }>('/audit-logs', {
    params: { page: params.page, limit: 10 },
  });
  return res.data.data;
}

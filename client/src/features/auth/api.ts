import { api, setAccessToken } from '@/lib/api';
import type { AuthUser } from './types';

interface LoginResponse {
  data: { accessToken: string; user: AuthUser };
}

export async function loginRequest(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<AuthUser> {
  const res = await api.post<LoginResponse>('/auth/login', { email, password, rememberMe });
  setAccessToken(res.data.data.accessToken);
  return res.data.data.user;
}

export async function logoutRequest(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await api.get<{ data: AuthUser }>('/auth/me');
  return res.data.data;
}

export async function updateProfileRequest(data: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<AuthUser> {
  const res = await api.put<{ data: AuthUser }>('/auth/profile', data);
  return res.data.data;
}

export async function changePasswordRequest(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await api.post('/auth/change-password', data);
}

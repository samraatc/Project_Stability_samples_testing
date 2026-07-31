import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequirePermission } from './require-permission';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import type { AuthUser } from '@/features/auth/types';

function renderWithPermissions(permissions: string[]) {
  const user: AuthUser = {
    id: 'u1',
    email: 'user@esms.local',
    firstName: 'Test',
    lastName: 'User',
    role: 'administrator',
    permissions,
    twoFactorEnabled: false,
  };
  const ctx: AuthContextValue = { user, isLoading: false, login: vi.fn(), logout: vi.fn() };
  return render(
    <AuthContext.Provider value={ctx}>
      <RequirePermission permission="users:read">
        <div>User management</div>
      </RequirePermission>
    </AuthContext.Provider>,
  );
}

describe('RequirePermission', () => {
  it('renders children when the permission is granted', () => {
    renderWithPermissions(['users:read']);
    expect(screen.getByText('User management')).toBeInTheDocument();
  });

  it('shows an access message when the permission is missing', () => {
    renderWithPermissions([]);
    expect(screen.queryByText('User management')).not.toBeInTheDocument();
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
  });
});

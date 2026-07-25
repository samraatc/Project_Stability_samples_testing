import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './protected-route';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import type { AuthUser } from '@/features/auth/types';

const viewer: AuthUser = {
  id: 'u1',
  email: 'viewer@esms.local',
  firstName: 'Vera',
  lastName: 'Viewer',
  role: 'viewer',
  permissions: [],
  twoFactorEnabled: false,
};

function renderWithAuth(value: Partial<AuthContextValue>) {
  const ctx: AuthContextValue = {
    user: null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...value,
  };
  return render(
    <AuthContext.Provider value={ctx}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Secret dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to the login page', () => {
    renderWithAuth({ user: null });
    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });

  it('renders children for authenticated users', () => {
    renderWithAuth({ user: viewer });
    expect(screen.getByText('Secret dashboard')).toBeInTheDocument();
  });

  it('shows a loading indicator while the session is being restored', () => {
    renderWithAuth({ user: null, isLoading: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  });
});

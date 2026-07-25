import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './login';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';

function renderLogin(login = vi.fn()) {
  const ctx: AuthContextValue = {
    user: null,
    isLoading: false,
    login,
    logout: vi.fn(),
  };
  render(
    <AuthContext.Provider value={ctx}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { login };
}

describe('LoginPage', () => {
  it('shows validation errors and does not submit when fields are invalid', async () => {
    const { login } = renderLogin();

    fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('submits credentials and shows a server error on failure', async () => {
    const login = vi.fn().mockRejectedValue(new Error('boom'));
    renderLogin(login);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'user@esms.local' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secret!12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to sign in. Please try again.',
    );
    expect(login).toHaveBeenCalledWith('user@esms.local', 'Secret!12345', false);
  });
});

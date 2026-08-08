import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { requestRefresh } from '@/lib/api';
import { fetchMe, loginRequest, logoutRequest } from './api';
import type { AuthUser } from './types';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateUser?: (user: AuthUser) => void;
  refetchUser?: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetchUser = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((updated: AuthUser) => {
    setUser(updated);
  }, []);

  // Session bootstrap: the refresh cookie (or stored session token) restores the user state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let token = await requestRefresh();
        if (token && !cancelled) {
          const me = await fetchMe();
          if (!cancelled) setUser(me);
        } else if (!cancelled) {
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const loggedIn = await loginRequest(email, password, rememberMe);
    setUser(loggedIn);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, updateUser, refetchUser }),
    [user, isLoading, login, logout, updateUser, refetchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

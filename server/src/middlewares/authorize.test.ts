import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { authorize, requirePermission } from './authorize';
import { AppError } from '../utils/app-error';

function requestWithUser(role: string, permissions: string[]): Request {
  return {
    user: {
      id: 'u1',
      email: 'user@esms.local',
      firstName: 'Test',
      lastName: 'User',
      role,
      permissions,
      twoFactorEnabled: false,
    },
  } as unknown as Request;
}

const res = {} as Response;

describe('authorize (RBAC)', () => {
  it('allows a listed role', () => {
    const next = vi.fn() as NextFunction;
    authorize('administrator', 'super-admin')(requestWithUser('administrator', []), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects an unlisted role with 403', () => {
    expect(() => authorize('super-admin')(requestWithUser('viewer', []), res, vi.fn())).toThrow(
      AppError,
    );
  });

  it('rejects unauthenticated requests with 401', () => {
    expect(() => authorize('viewer')({} as Request, res, vi.fn())).toThrowError(
      expect.objectContaining({ statusCode: 401 }),
    );
  });
});

describe('requirePermission (PBAC)', () => {
  it('allows when every permission is granted', () => {
    const next = vi.fn() as NextFunction;
    requirePermission('users:read', 'users:update')(
      requestWithUser('administrator', ['users:read', 'users:update', 'roles:read']),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects when any permission is missing with 403', () => {
    expect(() =>
      requirePermission('users:read', 'users:delete')(
        requestWithUser('administrator', ['users:read']),
        res,
        vi.fn(),
      ),
    ).toThrowError(expect.objectContaining({ statusCode: 403 }));
  });
});

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { seedRoles, seedSuperAdmin } from './seed';
import { authService } from './auth.service';
import { roleRepository } from '../roles/role.repository';
import { UserModel } from '../users/user.model';
import { LoginHistoryModel } from './login-history.model';
import { AuditLogModel } from '../audit/audit-log.model';
import { hashPassword } from '../../utils/password';
import { REFRESH_COOKIE_NAME } from '../../utils/cookies';

const ADMIN_EMAIL = 'admin@test.local';
const ADMIN_PASSWORD = 'Adm1n!Passw0rd';
const VIEWER_EMAIL = 'viewer@test.local';
const VIEWER_PASSWORD = 'V1ewer!Passw0rd';

let mongod: MongoMemoryServer;
let app: Express;

function refreshCookieFrom(res: request.Response): string {
  const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const cookie = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));
  expect(cookie, 'refresh cookie should be set').toBeDefined();
  return cookie!.split(';')[0]!;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('esms-test'));

  await seedRoles();
  await seedSuperAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);

  const viewerRole = await roleRepository.findByName('viewer');
  await UserModel.create({
    email: VIEWER_EMAIL,
    passwordHash: await hashPassword(VIEWER_PASSWORD),
    firstName: 'Vera',
    lastName: 'Viewer',
    role: viewerRole!._id,
    status: 'active',
  });

  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('POST /api/v1/auth/login', () => {
  it('authenticates valid credentials, returns access token and sets refresh cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
    expect(res.body.data.user.role).toBe('super-admin');
    expect(res.body.data.user.permissions).toContain('users:read');
    const cookie = refreshCookieFrom(res);
    expect(cookie.length).toBeGreaterThan(REFRESH_COOKIE_NAME.length + 40);
  });

  it('rejects an invalid password with a generic 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'Wrong!Passw0rd' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects an unknown email with the same generic 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.local', password: 'Wrong!Passw0rd' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects malformed payloads with validation details', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors.email).toBeDefined();
  });

  it('locks the account after 5 failed attempts and records history', async () => {
    for (let i = 0; i < 4; i += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: VIEWER_EMAIL, password: 'Wrong!Passw0rd' });
    }
    const fifth = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VIEWER_EMAIL, password: 'Wrong!Passw0rd' });
    expect(fifth.status).toBe(423);

    const lockedOut = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VIEWER_EMAIL, password: VIEWER_PASSWORD });
    expect(lockedOut.status).toBe(423);

    const history = await LoginHistoryModel.find({ email: VIEWER_EMAIL }).lean();
    expect(history.filter((h) => !h.success).length).toBeGreaterThanOrEqual(5);

    // Unlock for later tests.
    await UserModel.updateOne(
      { email: VIEWER_EMAIL },
      { $set: { lockedUntil: null, failedLoginAttempts: 0 } },
    );
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the user for a valid access token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(ADMIN_EMAIL);
  });

  it('rejects a missing token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates the refresh token and invalidates the old one', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const oldCookie = refreshCookieFrom(login);

    const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();
    const newCookie = refreshCookieFrom(refreshed);
    expect(newCookie).not.toBe(oldCookie);

    // Replaying the rotated-out token is treated as theft: all sessions die.
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(replay.status).toBe(401);

    const afterReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', newCookie);
    expect(afterReuse.status).toBe(401);

    const reuseAudit = await AuditLogModel.findOne({ action: 'auth.token.reuse-detected' });
    expect(reuseAudit).not.toBeNull();
  });

  it('rejects a request without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the session so the refresh token stops working', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const cookie = refreshCookieFrom(login);

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });
});

describe('password change and reset flows', () => {
  it('changes the password, revokes sessions, and accepts the new password', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VIEWER_EMAIL, password: VIEWER_PASSWORD });
    expect(login.status).toBe(200);
    const cookie = refreshCookieFrom(login);
    const token = login.body.data.accessToken;

    const weak = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: VIEWER_PASSWORD, newPassword: 'weak' });
    expect(weak.status).toBe(400);

    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: VIEWER_PASSWORD, newPassword: 'N3w!ViewerPass' });
    expect(changed.status).toBe(200);

    // Old refresh session is gone.
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);

    const relogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VIEWER_EMAIL, password: 'N3w!ViewerPass' });
    expect(relogin.status).toBe(200);
  });

  it('resets a forgotten password via token and rejects token reuse', async () => {
    const ack = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@test.local' });
    expect(ack.status).toBe(200); // same response for unknown emails

    const rawToken = await authService.forgotPassword(VIEWER_EMAIL, { ip: '', userAgent: '' });
    expect(rawToken).toBeTruthy();

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: 'R3set!ViewerPass' });
    expect(reset.status).toBe(200);

    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: 'An0ther!Pass123' });
    expect(reuse.status).toBe(400);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VIEWER_EMAIL, password: 'R3set!ViewerPass' });
    expect(login.status).toBe(200);
  });
});

describe('audit trail', () => {
  it('records login and password events', async () => {
    const actions = (await AuditLogModel.distinct('action')) as string[];
    expect(actions).toContain('auth.login');
    expect(actions).toContain('auth.password.change');
    expect(actions).toContain('auth.password.reset');
  });
});

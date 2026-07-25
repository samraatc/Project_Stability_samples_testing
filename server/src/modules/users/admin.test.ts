import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { seedRoles, seedSuperAdmin } from '../auth/seed';
import { roleRepository } from '../roles/role.repository';

const ADMIN_EMAIL = 'root@test.local';
const ADMIN_PASSWORD = 'R00t!Passw0rd';

let mongod: MongoMemoryServer;
let app: Express;
let adminToken: string;
let viewerRoleId: string;
let administratorRoleId: string;
let superAdminRoleId: string;

async function login(email: string, password: string): Promise<request.Response> {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('esms-admin-test'));
  await seedRoles();
  await seedSuperAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
  app = createApp();

  adminToken = (await login(ADMIN_EMAIL, ADMIN_PASSWORD)).body.data.accessToken;
  viewerRoleId = (await roleRepository.findByName('viewer'))!._id.toString();
  administratorRoleId = (await roleRepository.findByName('administrator'))!._id.toString();
  superAdminRoleId = (await roleRepository.findByName('super-admin'))!._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('user management', () => {
  let viewerUserId: string;

  it('creates a user', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'vera@test.local',
        firstName: 'Vera',
        lastName: 'Viewer',
        roleId: viewerRoleId,
        password: 'V1ewer!Passw0rd',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role.name).toBe('viewer');
    viewerUserId = res.body.data.id;
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'vera@test.local',
        firstName: 'Vera',
        lastName: 'Duplicate',
        roleId: viewerRoleId,
        password: 'V1ewer!Passw0rd',
      });
    expect(res.status).toBe(409);
  });

  it('rejects a weak password with validation details', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'weak@test.local',
        firstName: 'Weak',
        lastName: 'Password',
        roleId: viewerRoleId,
        password: 'weak',
      });
    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
  });

  it('lists users with search and pagination', async () => {
    const res = await request(app)
      .get('/api/v1/users?search=vera&page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].email).toBe('vera@test.local');
  });

  it('forbids a viewer from listing users (PBAC)', async () => {
    const viewerToken = (await login('vera@test.local', 'V1ewer!Passw0rd')).body.data.accessToken;
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });

  it('updates role and revokes the target user sessions', async () => {
    const viewerLogin = await login('vera@test.local', 'V1ewer!Passw0rd');
    const viewerToken = viewerLogin.body.data.accessToken;

    const res = await request(app)
      .patch(`/api/v1/users/${viewerUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roleId: administratorRoleId });

    expect(res.status).toBe(200);
    expect(res.body.data.role.name).toBe('administrator');

    // Access token still works (short-lived by design), but the refresh
    // session is gone.
    const cookies = (viewerLogin.headers['set-cookie'] ?? []) as unknown as string[];
    const cookie = cookies.find((c) => c.startsWith('esms_refresh='))!.split(';')[0]!;
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);

    // The fresh-DB-load in authenticate reflects the new role immediately.
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(me.body.data.role).toBe('administrator');
  });

  it('an administrator cannot assign the super-admin role (escalation guard)', async () => {
    const vera = await login('vera@test.local', 'V1ewer!Passw0rd');
    const veraToken = vera.body.data.accessToken; // vera is an administrator now

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${veraToken}`)
      .send({
        email: 'sneaky@test.local',
        firstName: 'Sneaky',
        lastName: 'Escalation',
        roleId: superAdminRoleId,
        password: 'Sneak!Passw0rd1',
      });

    expect(res.status).toBe(403);
  });

  it('prevents deactivating the last active super admin', async () => {
    const list = await request(app)
      .get(`/api/v1/users?search=${ADMIN_EMAIL}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const adminId = list.body.data.items[0].id;

    const res = await request(app)
      .patch(`/api/v1/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(400);
  });

  it('soft-deletes a user and hides them from listings', async () => {
    const created = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'temp@test.local',
        firstName: 'Temp',
        lastName: 'User',
        roleId: viewerRoleId,
        password: 'T3mp!Passw0rd1',
      });

    const del = await request(app)
      .delete(`/api/v1/users/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const list = await request(app)
      .get('/api/v1/users?search=temp@test.local')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.data.total).toBe(0);

    const loginDeleted = await login('temp@test.local', 'T3mp!Passw0rd1');
    expect(loginDeleted.status).toBe(401);
  });
});

describe('role management', () => {
  it('lists roles with the permission catalog and user counts', async () => {
    const res = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.catalog).toContain('users:read');
    expect(res.body.data.roles).toHaveLength(7);
    const superAdmin = res.body.data.roles.find((r: { name: string }) => r.name === 'super-admin');
    expect(superAdmin.userCount).toBeGreaterThanOrEqual(1);
  });

  it('updates a role permission set', async () => {
    const res = await request(app)
      .put(`/api/v1/roles/${viewerRoleId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: ['audit-logs:read'] });

    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual(['audit-logs:read']);
  });

  it('rejects unknown permission keys', async () => {
    const res = await request(app)
      .put(`/api/v1/roles/${viewerRoleId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: ['nuclear:launch'] });
    expect(res.status).toBe(400);
  });

  it('refuses to modify the super-admin role', async () => {
    const res = await request(app)
      .put(`/api/v1/roles/${superAdminRoleId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissions: [] });
    expect(res.status).toBe(400);
  });
});

describe('audit logs and login history', () => {
  it('returns audit entries with actor emails', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?limit=50')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    const actions = res.body.data.items.map((i: { action: string }) => i.action);
    expect(actions).toContain('users.create');
    expect(actions).toContain('roles.update');
  });

  it('filters login history by outcome', async () => {
    const res = await request(app)
      .get('/api/v1/login-history?success=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    expect(res.body.data.items.every((i: { success: boolean }) => i.success)).toBe(true);
  });
});

describe('SMTP settings', () => {
  it('stores settings and masks the password on read', async () => {
    const put = await request(app)
      .put('/api/v1/settings/smtp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        enabled: true,
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        username: 'mailer',
        password: 'super-secret',
        fromEmail: 'noreply@esms.local',
        fromName: 'ESMS',
      });

    expect(put.status).toBe(200);
    expect(put.body.data.password).toBe('********');

    const get = await request(app)
      .get('/api/v1/settings/smtp')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(get.body.data.host).toBe('smtp.example.com');
    expect(get.body.data.password).toBe('********');
  });

  it('keeps the stored password when the mask is submitted back', async () => {
    const res = await request(app)
      .put('/api/v1/settings/smtp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        enabled: true,
        host: 'smtp.example.com',
        port: 2525,
        secure: false,
        username: 'mailer',
        password: '********',
        fromEmail: 'noreply@esms.local',
        fromName: 'ESMS',
      });
    expect(res.status).toBe(200);

    const { settingsService } = await import('../settings/settings.service');
    const raw = await settingsService.getSmtpSettings();
    expect(raw.password).toBe('super-secret');
    expect(raw.port).toBe(2525);
  });

  it('requires host when enabling', async () => {
    const res = await request(app)
      .put('/api/v1/settings/smtp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, host: '', fromEmail: 'noreply@esms.local' });
    expect(res.status).toBe(400);
  });

  it('is forbidden without settings:manage', async () => {
    const vera = await login('vera@test.local', 'V1ewer!Passw0rd');
    const res = await request(app)
      .get('/api/v1/settings/smtp')
      .set('Authorization', `Bearer ${vera.body.data.accessToken}`);
    expect(res.status).toBe(403);
  });
});

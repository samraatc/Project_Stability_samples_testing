import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { EJSON } from 'bson';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { seedDemoUsers, seedRoles, seedSuperAdmin } from '../auth/seed';

const ADMIN_EMAIL = 'root@backup.local';
const ADMIN_PASSWORD = 'R00t!Passw0rd';
const DEMO_PASSWORD = 'Demo!Passw0rd1';

let mongod: MongoMemoryServer;
let app: Express;
let adminToken: string;
let viewerToken: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('esms-backup-test'));
  await seedRoles();
  await seedSuperAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
  await seedDemoUsers(DEMO_PASSWORD);
  app = createApp();

  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  adminToken = adminLogin.body.data.accessToken;

  const viewerLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'viewer@esms.local', password: DEMO_PASSWORD });
  viewerToken = viewerLogin.body.data.accessToken;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('seedDemoUsers', () => {
  it('creates one active user per non-super-admin role and is idempotent', async () => {
    // viewer login in beforeAll already proves the accounts work
    expect(viewerToken).toBeTruthy();

    // Second run must not duplicate or fail.
    await seedDemoUsers(DEMO_PASSWORD);
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(me.body.data.role).toBe('viewer');
  });
});

describe('backups', () => {
  it('creates and downloads a full EJSON backup', async () => {
    const res = await request(app)
      .post('/api/v1/backups')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('esms-backup-');

    const parsed = EJSON.parse(res.text) as {
      format: string;
      version: number;
      collections: Record<string, unknown[]>;
    };
    expect(parsed.format).toBe('esms-backup');
    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.collections)).toContain('users');
    expect(Object.keys(parsed.collections)).toContain('roles');
    expect(parsed.collections.users!.length).toBeGreaterThanOrEqual(7);
  });

  it('records backup history with size and collection counts', async () => {
    const res = await request(app)
      .get('/api/v1/backups')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const entry = res.body.data[0];
    expect(entry.sizeBytes).toBeGreaterThan(0);
    expect(entry.createdBy).toBe(ADMIN_EMAIL);
    expect(entry.collections.some((c: { name: string }) => c.name === 'users')).toBe(true);
  });

  it('is audited', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?action=backups.create')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('is super-admin only (403 for other roles)', async () => {
    const list = await request(app)
      .get('/api/v1/backups')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/v1/backups')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(create.status).toBe(403);
  });

  it('manages backup settings', async () => {
    // Get settings
    const getRes = await request(app)
      .get('/api/v1/backups/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.enabled).toBe(false);

    // Update settings
    const postRes = await request(app)
      .post('/api/v1/backups/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        enabled: true,
        schedule: 'weekly',
        cronExpression: '0 0 * * 0',
      });
    expect(postRes.status).toBe(200);
    expect(postRes.body.data.enabled).toBe(true);
    expect(postRes.body.data.schedule).toBe('weekly');
  });

  it('downloads and deletes backup records and files', async () => {
    // 1. Get history to find the backup ID from the previous test
    const listRes = await request(app)
      .get('/api/v1/backups')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const backup = listRes.body.data[0];
    expect(backup).toBeDefined();

    // 2. Download backup
    const downloadRes = await request(app)
      .get(`/api/v1/backups/${backup.id}/download`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-disposition']).toContain('attachment');

    // 3. Delete backup
    const deleteRes = await request(app)
      .delete(`/api/v1/backups/${backup.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // 4. Verify deleted
    const verifyRes = await request(app)
      .get(`/api/v1/backups/${backup.id}/download`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(verifyRes.status).toBe(404);
  });
});

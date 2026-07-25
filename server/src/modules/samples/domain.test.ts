import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { seedRoles, seedSuperAdmin } from '../auth/seed';
import { roleRepository } from '../roles/role.repository';
import { UserModel } from '../users/user.model';
import { hashPassword } from '../../utils/password';

const ADMIN_EMAIL = 'root@domain.local';
const ADMIN_PASSWORD = 'R00t!Passw0rd';
const VIEWER_EMAIL = 'viewer@domain.local';
const VIEWER_PASSWORD = 'V1ewer!Passw0rd';

let mongod: MongoMemoryServer;
let app: Express;
let adminToken: string;
let viewerToken: string;
let productId: string;
let batchId: string;
let sectionId: string;
let sampleId: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('esms-domain-test'));
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
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  adminToken = adminLogin.body.data.accessToken;
  const viewerLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: VIEWER_EMAIL, password: VIEWER_PASSWORD });
  viewerToken = viewerLogin.body.data.accessToken;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('products', () => {
  it('creates a product with an uppercased unique code', async () => {
    const res = await request(app).post('/api/v1/products').set(auth(adminToken)).send({
      name: 'Paracetamol Tablets',
      code: 'para-500',
      category: 'Analgesic',
      dosageForm: 'Tablet',
      strength: '500 mg',
      storageConditions: '25°C / 60% RH',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('PARA-500');
    productId = res.body.data._id;
  });

  it('rejects a duplicate product code with 409', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set(auth(adminToken))
      .send({ name: 'Copycat', code: 'PARA-500' });
    expect(res.status).toBe(409);
  });

  it('viewer can read but not create (PBAC)', async () => {
    const list = await request(app).get('/api/v1/products').set(auth(viewerToken));
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);

    const create = await request(app)
      .post('/api/v1/products')
      .set(auth(viewerToken))
      .send({ name: 'Nope', code: 'NOPE-1' });
    expect(create.status).toBe(403);
  });

  it('archives and restores a product, reflected in list filters', async () => {
    const archive = await request(app)
      .post(`/api/v1/products/${productId}/archive`)
      .set(auth(adminToken));
    expect(archive.status).toBe(200);

    const activeList = await request(app).get('/api/v1/products').set(auth(adminToken));
    expect(activeList.body.data.total).toBe(0);

    const archivedList = await request(app)
      .get('/api/v1/products?archived=true')
      .set(auth(adminToken));
    expect(archivedList.body.data.total).toBe(1);

    const restore = await request(app)
      .post(`/api/v1/products/${productId}/restore`)
      .set(auth(adminToken));
    expect(restore.status).toBe(200);
  });
});

describe('sections and batches', () => {
  it('creates a section and rejects duplicates', async () => {
    const res = await request(app)
      .post('/api/v1/sections')
      .set(auth(adminToken))
      .send({ name: 'Oral Solids', description: 'Tablets and capsules' });
    expect(res.status).toBe(201);
    sectionId = res.body.data._id;

    const dup = await request(app)
      .post('/api/v1/sections')
      .set(auth(adminToken))
      .send({ name: 'Oral Solids' });
    expect(dup.status).toBe(409);
  });

  it('creates a batch and enforces per-product duplicate validation', async () => {
    const res = await request(app).post('/api/v1/batches').set(auth(adminToken)).send({
      batchCode: 'b2026-001',
      productId,
      manufacturingDate: '2026-01-15',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.batchCode).toBe('B2026-001');
    batchId = res.body.data._id;

    const dup = await request(app).post('/api/v1/batches').set(auth(adminToken)).send({
      batchCode: 'B2026-001',
      productId,
      manufacturingDate: '2026-01-15',
    });
    expect(dup.status).toBe(409);
  });
});

describe('stability samples', () => {
  it('registers a sample with an auto-generated code', async () => {
    const res = await request(app).post('/api/v1/samples').set(auth(adminToken)).send({
      productId,
      batchId,
      sectionId,
      stabilityType: 'long-term',
      manufacturingDate: '2026-01-15',
      expiryDate: '2028-01-15',
      chargingDate: '2026-02-01',
      quantity: 60,
      remarks: 'Initial charge',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.sampleCode).toMatch(/^STB-\d{4}-0001$/);
    expect(res.body.data.intervals).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]);
    expect(res.body.data.status).toBe('registered');
    sampleId = res.body.data._id;
  });

  it('rejects a batch that belongs to a different product', async () => {
    const other = await request(app)
      .post('/api/v1/products')
      .set(auth(adminToken))
      .send({ name: 'Ibuprofen', code: 'IBU-200' });

    const res = await request(app).post('/api/v1/samples').set(auth(adminToken)).send({
      productId: other.body.data._id,
      batchId,
      sectionId,
      stabilityType: 'accelerated',
      manufacturingDate: '2026-01-15',
      expiryDate: '2028-01-15',
      chargingDate: '2026-02-01',
      quantity: 30,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('does not belong');
  });

  it('rejects non-standard intervals and a charging date before manufacture', async () => {
    const badInterval = await request(app)
      .post('/api/v1/samples')
      .set(auth(adminToken))
      .send({
        productId,
        batchId,
        sectionId,
        stabilityType: 'long-term',
        manufacturingDate: '2026-01-15',
        expiryDate: '2028-01-15',
        chargingDate: '2026-02-01',
        quantity: 10,
        intervals: [4],
      });
    expect(badInterval.status).toBe(400);

    const badCharge = await request(app).post('/api/v1/samples').set(auth(adminToken)).send({
      productId,
      batchId,
      sectionId,
      stabilityType: 'long-term',
      manufacturingDate: '2026-01-15',
      expiryDate: '2028-01-15',
      chargingDate: '2025-12-01',
      quantity: 10,
    });
    expect(badCharge.status).toBe(400);
    expect(badCharge.body.errors.chargingDate).toBeDefined();
  });

  it('clones a sample with a fresh code and registered status', async () => {
    const res = await request(app).post(`/api/v1/samples/${sampleId}/clone`).set(auth(adminToken));

    expect(res.status).toBe(201);
    expect(res.body.data.sampleCode).toMatch(/^STB-\d{4}-0002$/);
    expect(res.body.data.product).toBe(productId);
    expect(res.body.data.status).toBe('registered');
  });

  it('lists samples with populated references and filters', async () => {
    const res = await request(app)
      .get(`/api/v1/samples?productId=${productId}&stabilityType=long-term`)
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    const item = res.body.data.items[0];
    expect(item.product.code).toBe('PARA-500');
    expect(item.batch.batchCode).toBe('B2026-001');
    expect(item.section.name).toBe('Oral Solids');
  });

  it('archives a sample and updates status via PATCH', async () => {
    const patch = await request(app)
      .patch(`/api/v1/samples/${sampleId}`)
      .set(auth(adminToken))
      .send({ status: 'running', remarks: 'Chamber loaded' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('running');

    const archive = await request(app)
      .post(`/api/v1/samples/${sampleId}/archive`)
      .set(auth(adminToken));
    expect(archive.status).toBe(200);

    const list = await request(app).get('/api/v1/samples?archived=true').set(auth(adminToken));
    expect(list.body.data.items.some((s: { _id: string }) => s._id === sampleId)).toBe(true);
  });

  it('updates sample interval test status and uploads report', async () => {
    // Restore the sample first to make sure it's active
    await request(app).post(`/api/v1/samples/${sampleId}/restore`).set(auth(adminToken));

    // Update interval 3 status and report
    const res = await request(app)
      .patch(`/api/v1/samples/${sampleId}/intervals/3`)
      .set(auth(adminToken))
      .send({
        status: 'completed',
        reportName: 'test-report.pdf',
        reportData: 'data:application/pdf;base64,dGVzdA==',
      });

    expect(res.status).toBe(200);
    const updatedTest = res.body.data.intervalTests.find((t: any) => t.interval === 3);
    expect(updatedTest.status).toBe('completed');
    expect(updatedTest.reportName).toBe('test-report.pdf');
    expect(updatedTest.reportData).toBe('data:application/pdf;base64,dGVzdA==');
    expect(updatedTest.testedAt).toBeDefined();

    // Viewer cannot manage interval tests (forbidden)
    const forbiddenRes = await request(app)
      .patch(`/api/v1/samples/${sampleId}/intervals/3`)
      .set(auth(viewerToken))
      .send({ status: 'in_progress' });
    expect(forbiddenRes.status).toBe(403);
  });

  it('records audit entries for the domain actions', async () => {
    const res = await request(app).get('/api/v1/audit-logs?limit=100').set(auth(adminToken));
    const actions = res.body.data.items.map((i: { action: string }) => i.action);
    expect(actions).toContain('products.create');
    expect(actions).toContain('batches.create');
    expect(actions).toContain('samples.create');
    expect(actions).toContain('samples.clone');
    expect(actions).toContain('samples.updateIntervalTest');
  });
});

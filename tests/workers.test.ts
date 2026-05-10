import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, closeApp, loginAsAdmin, authGet, authPost, authPut } from './setup.js';

let app: FastifyInstance;
let adminToken: string;

beforeAll(async () => {
  app = await getApp();
  adminToken = (await loginAsAdmin(app)).accessToken;
});
afterAll(async () => { await closeApp(); });

describe('Workers — List', () => {
  it('should return paginated workers', async () => {
    const res = await authGet(app, '/api/v1/workers', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.pagination).toHaveProperty('total');
  });

  it('should filter by status', async () => {
    const res = await authGet(app, '/api/v1/workers?status=ACTIVE', adminToken);
    expect(res.statusCode).toBe(200);
  });

  it('should search by name', async () => {
    const res = await authGet(app, '/api/v1/workers?search=Rajesh', adminToken);
    expect(res.statusCode).toBe(200);
  });
});

describe('Workers — Detail', () => {
  it('should get worker with assigned sites', async () => {
    const list = await authGet(app, '/api/v1/workers', adminToken);
    const workerId = JSON.parse(list.body).data[0].id;
    const res = await authGet(app, `/api/v1/workers/${workerId}`, adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('assignedSites');
    expect(body).toHaveProperty('_count');
  });
});

describe('Workers — Stats', () => {
  it('should get worker stats', async () => {
    const list = await authGet(app, '/api/v1/workers', adminToken);
    const workerId = JSON.parse(list.body).data[0].id;
    const res = await authGet(app, `/api/v1/workers/${workerId}/stats`, adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('totalSubmissions');
    expect(body).toHaveProperty('thisMonth');
    expect(body).toHaveProperty('activeDaysThisMonth');
    expect(body).toHaveProperty('gpsComplianceRate');
  });
});

describe('Workers — Submissions', () => {
  it('should get worker submissions', async () => {
    const list = await authGet(app, '/api/v1/workers', adminToken);
    const workerId = JSON.parse(list.body).data[0].id;
    const res = await authGet(app, `/api/v1/workers/${workerId}/submissions`, adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
  });
});

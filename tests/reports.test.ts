import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, closeApp, loginAsAdmin, authGet, authPost } from './setup.js';

let app: FastifyInstance;
let adminToken: string;

beforeAll(async () => {
  app = await getApp();
  adminToken = (await loginAsAdmin(app)).accessToken;
});
afterAll(async () => { await closeApp(); });

describe('Reports — Generate', () => {
  it('should generate a daily report', async () => {
    const sitesRes = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(sitesRes.body).data[0].id;
    const res = await authPost(app, '/api/v1/reports/generate', adminToken, {
      siteId,
      reportType: 'DAILY',
      date: new Date().toISOString().split('T')[0],
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('reportType', 'DAILY');
  });
});

describe('Reports — List', () => {
  it('should return paginated reports', async () => {
    const res = await authGet(app, '/api/v1/reports', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toHaveProperty('total');
  });
});

describe('Reports — Detail', () => {
  it('should get report detail if any exist', async () => {
    const list = await authGet(app, '/api/v1/reports?limit=1', adminToken);
    const data = JSON.parse(list.body).data;
    if (data.length === 0) return;
    const res = await authGet(app, `/api/v1/reports/${data[0].id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty('id');
  });
});

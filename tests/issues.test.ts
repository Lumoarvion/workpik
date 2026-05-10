import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, closeApp, loginAsAdmin, authGet, authPut } from './setup.js';

let app: FastifyInstance;
let adminToken: string;

beforeAll(async () => {
  app = await getApp();
  adminToken = (await loginAsAdmin(app)).accessToken;
});
afterAll(async () => { await closeApp(); });

describe('Issues — List', () => {
  it('should return paginated issues', async () => {
    const res = await authGet(app, '/api/v1/issues', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toHaveProperty('total');
  });

  it('should filter by severity', async () => {
    const res = await authGet(app, '/api/v1/issues?severity=HIGH', adminToken);
    expect(res.statusCode).toBe(200);
  });

  it('should filter by status', async () => {
    const res = await authGet(app, '/api/v1/issues?status=OPEN', adminToken);
    expect(res.statusCode).toBe(200);
  });
});

describe('Issues — Lifecycle', () => {
  it('should get issue detail if any exist', async () => {
    const list = await authGet(app, '/api/v1/issues?limit=1', adminToken);
    const data = JSON.parse(list.body).data;
    if (data.length === 0) return;
    const res = await authGet(app, `/api/v1/issues/${data[0].id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty('site');
    expect(JSON.parse(res.body)).toHaveProperty('worker');
  });
});

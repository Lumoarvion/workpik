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

describe('Alerts — List', () => {
  it('should return paginated alerts', async () => {
    const res = await authGet(app, '/api/v1/alerts', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toHaveProperty('total');
  });

  it('should filter by isRead', async () => {
    const res = await authGet(app, '/api/v1/alerts?isRead=false', adminToken);
    expect(res.statusCode).toBe(200);
  });
});

describe('Alerts — Summary', () => {
  it('should return unread alert counts by type', async () => {
    const res = await authGet(app, '/api/v1/alerts/summary', adminToken);
    expect(res.statusCode).toBe(200);
  });
});

describe('Alerts — Mark read', () => {
  it('should mark all alerts as read', async () => {
    const res = await authPut(app, '/api/v1/alerts/read-all', adminToken);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('All alerts marked as read');
  });
});

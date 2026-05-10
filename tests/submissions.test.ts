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

describe('Submissions — List', () => {
  it('should return paginated submissions', async () => {
    const res = await authGet(app, '/api/v1/submissions', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('page');
  });

  it('should filter by siteId', async () => {
    const sitesRes = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(sitesRes.body).data[0].id;
    const res = await authGet(app, `/api/v1/submissions?siteId=${siteId}`, adminToken);
    expect(res.statusCode).toBe(200);
  });

  it('should 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/submissions' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Submissions — Stats', () => {
  it('should return submission stats', async () => {
    const res = await authGet(app, '/api/v1/submissions/stats', adminToken);
    expect(res.statusCode).toBe(200);
  });
});

describe('Submissions — Map data', () => {
  it('should return map data', async () => {
    const res = await authGet(app, '/api/v1/submissions/map-data', adminToken);
    expect(res.statusCode).toBe(200);
  });
});

describe('Submissions — Detail & Flag', () => {
  it('should get submission detail if any exist', async () => {
    const listRes = await authGet(app, '/api/v1/submissions?limit=1', adminToken);
    const data = JSON.parse(listRes.body).data;
    if (data.length === 0) return; // no submissions to test
    const res = await authGet(app, `/api/v1/submissions/${data[0].id}`, adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('photos');
  });

  it('should flag and unflag a submission if any exist', async () => {
    const listRes = await authGet(app, '/api/v1/submissions?limit=1', adminToken);
    const data = JSON.parse(listRes.body).data;
    if (data.length === 0) return;

    const flagRes = await authPut(app, `/api/v1/submissions/${data[0].id}/flag`, adminToken, {
      reason: 'Test flag',
    });
    expect(flagRes.statusCode).toBe(200);

    const unflagRes = await authPut(app, `/api/v1/submissions/${data[0].id}/unflag`, adminToken);
    expect(unflagRes.statusCode).toBe(200);
  });
});

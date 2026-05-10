import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, closeApp, loginAsAdmin, loginAsManager, loginAsClient, authGet } from './setup.js';

let app: FastifyInstance;
let adminToken: string;
let managerToken: string;
let clientToken: string;

beforeAll(async () => {
  app = await getApp();
  adminToken = (await loginAsAdmin(app)).accessToken;
  managerToken = (await loginAsManager(app)).accessToken;
  clientToken = (await loginAsClient(app)).accessToken;
});

afterAll(async () => { await closeApp(); });

describe('Dashboard', () => {
  it('admin should get full dashboard', async () => {
    const res = await authGet(app, '/api/v1/dashboard', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.today).toHaveProperty('totalSubmissions');
    expect(body.today).toHaveProperty('activeWorkers');
    expect(body.today).toHaveProperty('totalSites');
    expect(body.today).toHaveProperty('issuesReported');
    expect(body.sitesSummary).toBeInstanceOf(Array);
    expect(body.recentActivity).toBeInstanceOf(Array);
    expect(body.alerts).toBeInstanceOf(Array);
  });

  it('manager should get dashboard (scoped to assigned sites)', async () => {
    const res = await authGet(app, '/api/v1/dashboard', managerToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('today');
    expect(body).toHaveProperty('sitesSummary');
  });

  it('client should get dashboard (scoped to assigned sites)', async () => {
    const res = await authGet(app, '/api/v1/dashboard', clientToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('today');
  });

  it('should 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/dashboard' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Dashboard — Site detail', () => {
  it('admin should get site dashboard', async () => {
    const sitesRes = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(sitesRes.body).data[0].id;
    const res = await authGet(app, `/api/v1/dashboard/site/${siteId}`, adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.today).toHaveProperty('submissions');
    expect(body).toHaveProperty('workerActivity');
    expect(body).toHaveProperty('zoneCoverage');
    expect(body).toHaveProperty('recentSubmissions');
  });
});

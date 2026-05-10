import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, closeApp, loginAsAdmin, loginAsClient, authGet, authPost, authPut, authDelete } from './setup.js';

let app: FastifyInstance;
let adminToken: string;
let clientToken: string;

beforeAll(async () => {
  app = await getApp();
  adminToken = (await loginAsAdmin(app)).accessToken;
  clientToken = (await loginAsClient(app)).accessToken;
});
afterAll(async () => { await closeApp(); });

describe('Sites — List', () => {
  it('admin should list all sites', async () => {
    const res = await authGet(app, '/api/v1/sites', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.pagination).toHaveProperty('total');
  });

  it('should filter by status', async () => {
    const res = await authGet(app, '/api/v1/sites?status=ACTIVE', adminToken);
    expect(res.statusCode).toBe(200);
  });

  it('should search by name', async () => {
    const res = await authGet(app, '/api/v1/sites?search=abc', adminToken);
    expect(res.statusCode).toBe(200);
  });
});

describe('Sites — Detail', () => {
  it('should get site with zones, workers, managers, clients', async () => {
    const list = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(list.body).data[0].id;
    const res = await authGet(app, `/api/v1/sites/${siteId}`, adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('zones');
    expect(body).toHaveProperty('workers');
    expect(body).toHaveProperty('managers');
    expect(body).toHaveProperty('clients');
    expect(body).toHaveProperty('_count');
  });

  it('should 404 for non-existent site', async () => {
    const res = await authGet(app, '/api/v1/sites/00000000-0000-0000-0000-000000000000', adminToken);
    expect(res.statusCode).toBe(404);
  });
});

describe('Sites — RBAC', () => {
  it('client should NOT create a site (403)', async () => {
    const res = await authPost(app, '/api/v1/sites', clientToken, {
      name: 'Test Site', address: '123 St',
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin should create a site', async () => {
    const res = await authPost(app, '/api/v1/sites', adminToken, {
      name: 'Test Site ' + Date.now(), address: 'Test Addr',
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name');
  });

  it('client should NOT manage zones (403)', async () => {
    const list = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(list.body).data[0].id;
    const res = await authPost(app, `/api/v1/sites/${siteId}/zones`, clientToken, { name: 'Bad Zone' });
    expect(res.statusCode).toBe(403);
  });

  it('client should NOT assign workers (403)', async () => {
    const list = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(list.body).data[0].id;
    const res = await authPost(app, `/api/v1/sites/${siteId}/workers`, clientToken, {
      workerId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('Sites — Sub-resources', () => {
  it('should list zones for a site', async () => {
    const list = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(list.body).data[0].id;
    const res = await authGet(app, `/api/v1/sites/${siteId}/zones`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toBeInstanceOf(Array);
  });

  it('should list workers for a site', async () => {
    const list = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(list.body).data[0].id;
    const res = await authGet(app, `/api/v1/sites/${siteId}/workers`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toBeInstanceOf(Array);
  });

  it('should list managers for a site', async () => {
    const list = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(list.body).data[0].id;
    const res = await authGet(app, `/api/v1/sites/${siteId}/managers`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toBeInstanceOf(Array);
  });

  it('should list clients for a site', async () => {
    const list = await authGet(app, '/api/v1/sites', adminToken);
    const siteId = JSON.parse(list.body).data[0].id;
    const res = await authGet(app, `/api/v1/sites/${siteId}/clients`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toBeInstanceOf(Array);
  });
});

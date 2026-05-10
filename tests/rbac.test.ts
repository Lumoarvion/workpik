import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, closeApp, loginAsAdmin, loginAsManager, loginAsClient, authPost, authPut, authDelete, authGet } from './setup.js';

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

describe('RBAC — Work Types', () => {
  it('client cannot create work type (403)', async () => {
    const res = await authPost(app, '/api/v1/work-types', clientToken, { name: 'Bad Type' });
    expect(res.statusCode).toBe(403);
  });

  it('manager cannot create work type (403)', async () => {
    const res = await authPost(app, '/api/v1/work-types', managerToken, { name: 'Bad Type' });
    expect(res.statusCode).toBe(403);
  });

  it('admin can create work type', async () => {
    const res = await authPost(app, '/api/v1/work-types', adminToken, { name: 'Test Type ' + Date.now() });
    expect(res.statusCode).toBe(201);
  });

  it('client cannot delete work type (403)', async () => {
    const list = await authGet(app, '/api/v1/work-types', adminToken);
    const types = JSON.parse(list.body);
    const last = types[types.length - 1];
    const res = await authDelete(app, `/api/v1/work-types/${last.id}`, clientToken);
    expect(res.statusCode).toBe(403);
  });
});

describe('RBAC — Users', () => {
  it('client cannot create user (403)', async () => {
    const res = await authPost(app, '/api/v1/users', clientToken, {
      email: 'test@test.com', fullName: 'Test', password: 'Test@123', role: 'MANAGER',
    });
    expect(res.statusCode).toBe(403);
  });

  it('manager cannot create user (403)', async () => {
    const res = await authPost(app, '/api/v1/users', managerToken, {
      email: 'test@test.com', fullName: 'Test', password: 'Test@123', role: 'MANAGER',
    });
    expect(res.statusCode).toBe(403);
  });

  it('client cannot deactivate user (403)', async () => {
    const users = await authGet(app, '/api/v1/users', adminToken);
    const userId = JSON.parse(users.body).data[0].id;
    const res = await authDelete(app, `/api/v1/users/${userId}`, clientToken);
    expect(res.statusCode).toBe(403);
  });
});

describe('RBAC — Workers', () => {
  it('client cannot create worker (403)', async () => {
    const res = await authPost(app, '/api/v1/workers', clientToken, {
      name: 'Bad Worker', phone: '1111111111',
    });
    expect(res.statusCode).toBe(403);
  });

  it('manager cannot create worker (403)', async () => {
    const res = await authPost(app, '/api/v1/workers', managerToken, {
      name: 'Bad Worker', phone: '1111111111',
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin can create worker', async () => {
    const phone = '99' + Date.now().toString().slice(-8);
    const res = await authPost(app, '/api/v1/workers', adminToken, {
      name: 'Test Worker', phone,
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('RBAC — Company', () => {
  it('client cannot update company (403)', async () => {
    const res = await authPut(app, '/api/v1/company', clientToken, { name: 'Hacked' });
    expect(res.statusCode).toBe(403);
  });

  it('manager cannot update company (403)', async () => {
    const res = await authPut(app, '/api/v1/company', managerToken, { name: 'Hacked' });
    expect(res.statusCode).toBe(403);
  });

  it('admin can update company', async () => {
    const res = await authPut(app, '/api/v1/company', adminToken, { address: 'Updated Address' });
    expect(res.statusCode).toBe(200);
  });

  it('any user can view company', async () => {
    const res = await authGet(app, '/api/v1/company', clientToken);
    expect(res.statusCode).toBe(200);
  });
});

describe('RBAC — Site Sub-resources (mutations)', () => {
  let siteId: string;

  beforeAll(async () => {
    const res = await authGet(app, '/api/v1/sites', adminToken);
    siteId = JSON.parse(res.body).data[0].id;
  });

  it('client cannot add zone (403)', async () => {
    const res = await authPost(app, `/api/v1/sites/${siteId}/zones`, clientToken, { name: 'Bad Zone' });
    expect(res.statusCode).toBe(403);
  });

  it('client cannot add work type to site (403)', async () => {
    const res = await authPost(app, `/api/v1/sites/${siteId}/work-types`, clientToken, {
      workTypeId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(403);
  });

  it('client cannot assign manager to site (403)', async () => {
    const res = await authPost(app, `/api/v1/sites/${siteId}/managers`, clientToken, {
      userId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(403);
  });

  it('manager cannot assign workers (403)', async () => {
    const res = await authPost(app, `/api/v1/sites/${siteId}/workers`, managerToken, {
      workerId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(403);
  });
});

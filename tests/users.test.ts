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

describe('Users — List', () => {
  it('should return paginated users', async () => {
    const res = await authGet(app, '/api/v1/users', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.pagination).toHaveProperty('total');
  });
});

describe('Users — Me', () => {
  it('should return own profile', async () => {
    const res = await authGet(app, '/api/v1/users/me', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('email', 'admin@cleanpro.com');
    expect(body).toHaveProperty('role', 'ADMIN');
  });
});

describe('Users — Password change', () => {
  it('should reject wrong current password', async () => {
    const res = await authPut(app, '/api/v1/users/me/password', adminToken, {
      currentPassword: 'WrongPassword',
      newPassword: 'NewPass@123',
    });
    expect(res.statusCode).toBe(400);
  });

  it('should change password with correct current password', async () => {
    const res = await authPut(app, '/api/v1/users/me/password', adminToken, {
      currentPassword: 'Admin@123',
      newPassword: 'Admin@123', // same password to keep seed data stable
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Password updated');
  });
});

describe('Users — CRUD', () => {
  it('should get user by id', async () => {
    const list = await authGet(app, '/api/v1/users', adminToken);
    const userId = JSON.parse(list.body).data[0].id;
    const res = await authGet(app, `/api/v1/users/${userId}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty('email');
  });
});

describe('Users — Work Types', () => {
  it('should list work types', async () => {
    const res = await authGet(app, '/api/v1/work-types', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThan(0);
  });
});

describe('Company — Info', () => {
  it('should get company info', async () => {
    const res = await authGet(app, '/api/v1/company', adminToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('id');
  });
});

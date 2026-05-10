import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, closeApp, loginAsAdmin } from './setup.js';

let app: FastifyInstance;

beforeAll(async () => { app = await getApp(); });
afterAll(async () => { await closeApp(); });

describe('Auth — Login', () => {
  it('should login with valid admin credentials', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@cleanpro.com', password: 'Admin@123' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body.user).toMatchObject({ email: 'admin@cleanpro.com', role: 'ADMIN' });
    expect(body.company).toHaveProperty('name');
  });

  it('should login as manager', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'priya@cleanpro.com', password: 'Manager@123' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).user.role).toBe('MANAGER');
  });

  it('should login as client', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'client@abcsociety.com', password: 'Client@123' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).user.role).toBe('CLIENT');
  });

  it('should 401 for wrong password', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'admin@cleanpro.com', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should 401 for non-existent email', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { email: 'nobody@cleanpro.com', password: 'test' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth — OTP (mobile)', () => {
  it('should send OTP for valid worker phone', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/request-otp',
      payload: { phone: '9876543210' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('OTP sent');
    expect(body.otp).toBe('123456'); // dev mode
  });

  it('should 404 for unknown phone', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/request-otp',
      payload: { phone: '0000000000' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('should verify OTP and return worker + sites + tokens', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/auth/request-otp', payload: { phone: '9876543210' } });
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/verify-otp',
      payload: { phone: '9876543210', otp: '123456' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.worker).toHaveProperty('id');
    expect(body.worker.phone).toBe('9876543210');
    expect(body.assignedSites).toBeInstanceOf(Array);
    expect(body).toHaveProperty('accessToken');
  });

  it('should 401 for wrong OTP', async () => {
    await app.inject({ method: 'POST', url: '/api/v1/auth/request-otp', payload: { phone: '9876543210' } });
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/verify-otp',
      payload: { phone: '9876543210', otp: '999999' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth — Refresh token', () => {
  it('should return new tokens with valid refresh token', async () => {
    const { refreshToken } = await loginAsAdmin(app);
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
  });

  it('should 401 for invalid refresh token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'invalid.token.here' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth — Logout', () => {
  it('should accept logout', async () => {
    const { accessToken } = await loginAsAdmin(app);
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toBe('Logged out');
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getApp, closeApp, authGet } from './setup.js';

let app: FastifyInstance;
let workerToken: string;

beforeAll(async () => {
  app = await getApp();
  // Get worker token via OTP flow
  await app.inject({ method: 'POST', url: '/api/v1/auth/request-otp', payload: { phone: '9876543210' } });
  const res = await app.inject({
    method: 'POST', url: '/api/v1/auth/verify-otp',
    payload: { phone: '9876543210', otp: '123456' },
  });
  workerToken = JSON.parse(res.body).accessToken;
});
afterAll(async () => { await closeApp(); });

describe('Mobile — Sync', () => {
  it('should return assigned sites, work types, and zones', async () => {
    const res = await authGet(app, '/api/v1/mobile/sync', workerToken);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('assignedSites');
    expect(body.assignedSites).toBeInstanceOf(Array);
    if (body.assignedSites.length > 0) {
      const site = body.assignedSites[0];
      expect(site).toHaveProperty('id');
      expect(site).toHaveProperty('name');
      expect(site).toHaveProperty('zones');
      expect(site).toHaveProperty('workTypes');
    }
  });

  it('should 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/mobile/sync' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Mobile — Submission (unit)', () => {
  it('should 401 without token for POST submissions', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/mobile/submissions' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Mobile — Issues (unit)', () => {
  it('should 401 without token for POST issues', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/mobile/issues' });
    expect(res.statusCode).toBe(401);
  });
});

import { buildApp } from '../src/server.js';
import type { FastifyInstance } from 'fastify';

let _app: FastifyInstance | null = null;

/**
 * Get or create the Fastify app instance for testing.
 * Uses app.inject() so no actual server port is needed.
 */
export async function getApp(): Promise<FastifyInstance> {
  if (!_app) {
    _app = await buildApp();
    await _app.ready();
  }
  return _app;
}

/**
 * Close the app instance. Call this in afterAll().
 */
export async function closeApp(): Promise<void> {
  if (_app) {
    await _app.close();
    _app = null;
  }
}

/**
 * Login as admin and return tokens + user info.
 */
export async function loginAsAdmin(app: FastifyInstance) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@cleanpro.com', password: 'Admin@123' },
  });
  const body = JSON.parse(res.body);
  return {
    accessToken: body.accessToken as string,
    refreshToken: body.refreshToken as string,
    user: body.user,
    company: body.company,
  };
}

/**
 * Login as manager and return tokens.
 */
export async function loginAsManager(app: FastifyInstance) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'priya@cleanpro.com', password: 'Manager@123' },
  });
  const body = JSON.parse(res.body);
  return {
    accessToken: body.accessToken as string,
    refreshToken: body.refreshToken as string,
    user: body.user,
  };
}

/**
 * Login as client and return tokens.
 */
export async function loginAsClient(app: FastifyInstance) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'client@abcsociety.com', password: 'Client@123' },
  });
  const body = JSON.parse(res.body);
  return {
    accessToken: body.accessToken as string,
    refreshToken: body.refreshToken as string,
    user: body.user,
  };
}

/** Authenticated GET */
export async function authGet(app: FastifyInstance, url: string, token: string) {
  return app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });
}

/** Authenticated POST */
export async function authPost(app: FastifyInstance, url: string, token: string, payload?: unknown) {
  return app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` }, payload });
}

/** Authenticated PUT */
export async function authPut(app: FastifyInstance, url: string, token: string, payload?: unknown) {
  return app.inject({ method: 'PUT', url, headers: { authorization: `Bearer ${token}` }, payload });
}

/** Authenticated DELETE */
export async function authDelete(app: FastifyInstance, url: string, token: string) {
  return app.inject({ method: 'DELETE', url, headers: { authorization: `Bearer ${token}` } });
}

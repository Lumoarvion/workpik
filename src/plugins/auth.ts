import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface JwtPayload {
  id: string;
  companyId: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CLIENT' | 'WORKER';
  type: 'user' | 'worker';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateOptional: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    generateTokens: (payload: Omit<JwtPayload, 'iat' | 'exp'>) => { accessToken: string; refreshToken: string };
    verifyRefreshToken: (token: string) => JwtPayload;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key';

export const authPlugin = fp(async (fastify: FastifyInstance) => {
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    try {
      const token = authHeader.substring(7);
      // Check if token is blacklisted (logged out)
      const blacklisted = await fastify.redis.get(`blacklist:${token}`);
      if (blacklisted) {
        reply.code(401).send({ error: 'Token has been revoked' });
        return;
      }
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload & { iat?: number };
      // For worker tokens, check if admin has force-revoked all sessions
      if (payload.type === 'worker') {
        const revokedAt = await fastify.redis.get(`worker:revoked:${payload.id}`);
        if (revokedAt && payload.iat && payload.iat < parseInt(revokedAt, 10)) {
          reply.code(401).send({ error: 'Session has been revoked. Please log in again.' });
          return;
        }
      }
      request.user = payload;
    } catch {
      reply.code(401).send({ error: 'Invalid token' });
    }
  };

  const authenticateOptional = async (request: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        request.user = jwt.verify(authHeader.substring(7), JWT_SECRET) as JwtPayload;
      } catch {
        // Ignore invalid tokens for optional auth
      }
    }
  };

  const generateTokens = (payload: Omit<JwtPayload, 'iat' | 'exp'>) => {
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  };

  const verifyRefreshToken = (token: string): JwtPayload => {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  };

  fastify.decorate('authenticate', authenticate);
  fastify.decorate('authenticateOptional', authenticateOptional);
  fastify.decorate('generateTokens', generateTokens);
  fastify.decorate('verifyRefreshToken', verifyRefreshToken);
});

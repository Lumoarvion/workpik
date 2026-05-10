import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { s3Plugin } from './plugins/s3.js';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { companyRoutes } from './routes/company.js';
import { userRoutes } from './routes/users.js';
import { workerRoutes } from './routes/workers.js';
import { siteRoutes } from './routes/sites.js';
import { workTypeRoutes } from './routes/workTypes.js';
import { submissionRoutes } from './routes/submissions.js';
import { issueRoutes } from './routes/issues.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { alertRoutes } from './routes/alerts.js';
import { reportRoutes } from './routes/reports.js';
import { mobileRoutes } from './routes/mobile.js';
import { billingRoutes } from './routes/billing.js';
import { mbRoutes } from './routes/mb.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

async function buildApp() {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true,
  });

  // Allow empty JSON bodies for PUT/PATCH requests (Fastify 5 rejects them by default)
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const str = (body as string).trim();
      done(null, str ? JSON.parse(str) : {});
    } catch (err: any) {
      done(err, undefined);
    }
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
    },
  });

  // Plugins
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(s3Plugin);
  await app.register(authPlugin);

  // Health check
  app.get('/health', async (request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      await app.redis.ping();
      return { status: 'ok', timestamp: new Date().toISOString() };
    } catch (err) {
      reply.code(503);
      return { status: 'error', message: 'Service unhealthy' };
    }
  });

  app.get('/api/v1/status', async () => {
    return { version: '1.0.0', name: 'Workpik API' };
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(companyRoutes, { prefix: '/api/v1/company' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(workerRoutes, { prefix: '/api/v1/workers' });
  await app.register(siteRoutes, { prefix: '/api/v1/sites' });
  await app.register(workTypeRoutes, { prefix: '/api/v1/work-types' });
  await app.register(submissionRoutes, { prefix: '/api/v1/submissions' });
  await app.register(issueRoutes, { prefix: '/api/v1/issues' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(alertRoutes, { prefix: '/api/v1/alerts' });
  await app.register(reportRoutes, { prefix: '/api/v1/reports' });
  await app.register(mobileRoutes, { prefix: '/api/v1/mobile' });
  await app.register(billingRoutes, { prefix: '/api/v1' });
  await app.register(mbRoutes, { prefix: '/api/v1' });

  return app;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`Server running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export { buildApp };

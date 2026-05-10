import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination.js';

const createWorkerSchema = z.object({
  name: z.string().min(2).max(255),
  phone: z.string().min(10).max(15),
  language: z.string().max(5).default('en'),
});

const updateWorkerSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().min(10).max(15).optional(),
  language: z.string().max(5).optional(),
});

const listWorkersQuery = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  siteId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export async function workerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const query = listWorkersQuery.parse(request.query);
    const where: any = { companyId: request.user!.companyId };
    if (query.status) where.status = query.status;
    if (query.siteId) where.assignedSites = { some: { siteId: query.siteId } };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const [data, total] = await Promise.all([
      app.prisma.worker.findMany({
        where,
        include: {
          assignedSites: { include: { site: { select: { id: true, name: true } } } },
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate(query),
      }),
      app.prisma.worker.count({ where }),
    ]);
    return paginatedResponse(data, total, query);
  });

  app.post('/', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = createWorkerSchema.parse(request.body);
    const existing = await app.prisma.worker.findUnique({
      where: { companyId_phone: { companyId: request.user!.companyId, phone: body.phone } },
    });
    if (existing) return reply.code(409).send({ error: 'Worker with this phone already exists' });

    const worker = await app.prisma.worker.create({
      data: { companyId: request.user!.companyId, ...body },
    });
    return reply.code(201).send(worker);
  });

  app.post('/bulk', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const schema = z.object({
      workers: z.array(z.object({ name: z.string(), phone: z.string() })),
    });
    const { workers } = schema.parse(request.body);
    let created = 0;
    const errors: string[] = [];

    for (const w of workers) {
      try {
        await app.prisma.worker.create({
          data: { companyId: request.user!.companyId, name: w.name, phone: w.phone },
        });
        created++;
      } catch (err: any) {
        errors.push(`${w.phone}: ${err.code === 'P2002' ? 'Already exists' : err.message}`);
      }
    }
    return reply.code(201).send({ created, failed: errors.length, errors });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const worker = await app.prisma.worker.findFirst({
      where: { id, companyId: request.user!.companyId },
      include: {
        assignedSites: { include: { site: { select: { id: true, name: true } } } },
        _count: { select: { submissions: true, issues: true } },
      },
    });
    if (!worker) return reply.code(404).send({ error: 'Worker not found' });
    return worker;
  });

  app.put('/:id', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const body = updateWorkerSchema.parse(request.body);
    const result = await app.prisma.worker.updateMany({
      where: { id, companyId: request.user!.companyId },
      data: body,
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Worker not found' });
    return app.prisma.worker.findUnique({ where: { id } });
  });

  app.put('/:id/deactivate', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const result = await app.prisma.worker.updateMany({
      where: { id, companyId: request.user!.companyId },
      data: { status: 'INACTIVE' },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Worker not found' });
    return { message: 'Worker deactivated' };
  });

  app.put('/:id/reactivate', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const result = await app.prisma.worker.updateMany({
      where: { id, companyId: request.user!.companyId },
      data: { status: 'ACTIVE' },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Worker not found' });
    return { message: 'Worker reactivated' };
  });

  app.get('/:id/submissions', async (request) => {
    const { id } = request.params as { id: string };
    const query = paginationSchema.parse(request.query);
    const where = { workerId: id, worker: { companyId: request.user!.companyId } };
    const [data, total] = await Promise.all([
      app.prisma.submission.findMany({
        where,
        include: {
          photos: { select: { id: true, thumbnailUrl: true, photoUrl: true }, orderBy: { sortOrder: 'asc' } },
          site: { select: { id: true, name: true } },
          workType: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate(query),
      }),
      app.prisma.submission.count({ where }),
    ]);
    return paginatedResponse(data, total, query);
  });

  app.get('/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string };
    const worker = await app.prisma.worker.findFirst({
      where: { id, companyId: request.user!.companyId },
    });
    if (!worker) return reply.code(404).send({ error: 'Worker not found' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalSubmissions, monthSubmissions, gpsData] = await Promise.all([
      app.prisma.submission.count({ where: { workerId: id } }),
      app.prisma.submission.findMany({
        where: { workerId: id, createdAt: { gte: startOfMonth } },
        select: { createdAt: true, isWithinRadius: true },
      }),
      app.prisma.submission.aggregate({
        where: { workerId: id },
        _avg: { distanceFromSite: true },
        _count: { _all: true },
      }),
    ]);

    const activeDays = new Set(monthSubmissions.map((s) => s.createdAt.toISOString().split('T')[0])).size;
    const withinRadius = monthSubmissions.filter((s) => s.isWithinRadius).length;
    const gpsComplianceRate = monthSubmissions.length > 0 ? Math.round((withinRadius / monthSubmissions.length) * 100) : 100;

    return {
      totalSubmissions,
      thisMonth: monthSubmissions.length,
      activeDaysThisMonth: activeDays,
      gpsComplianceRate,
    };
  });

  // Revoke all active sessions for a worker (ADMIN only)
  app.post('/:id/revoke-sessions', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can revoke sessions' });
    }
    const { id } = request.params as { id: string };
    const worker = await app.prisma.worker.findFirst({
      where: { id, companyId: request.user!.companyId },
    });
    if (!worker) return reply.code(404).send({ error: 'Worker not found' });

    // Store revocation timestamp — auth middleware checks this for worker tokens
    const revokedAt = Math.floor(Date.now() / 1000); // Unix seconds, matches JWT iat
    await (app as any).redis.set(`worker:revoked:${id}`, revokedAt, 'EX', 60 * 60 * 24 * 30); // 30 days

    return { message: 'All sessions revoked. Worker must re-login.', revokedAt };
  });
}

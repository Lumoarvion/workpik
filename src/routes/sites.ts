import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination.js';

const createSiteSchema = z.object({
  name: z.string().min(2).max(255),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  gpsRadiusMetres: z.number().int().min(50).max(500).default(200),
  minPhotosPerDay: z.number().int().min(1).default(1),
  beforeAfterEnabled: z.boolean().default(false),
  expectedStartTime: z.string().max(5).optional(),
  expectedEndTime: z.string().max(5).optional(),
  contactName: z.string().max(255).optional(),
  contactPhone: z.string().max(15).optional(),
  notes: z.string().optional(),
  budget: z.number().min(0).optional(),
});

const updateSiteSchema = createSiteSchema.partial();

const listSitesQuery = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  search: z.string().optional(),
});

export async function siteRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const query = listSitesQuery.parse(request.query);
    const where: any = { companyId: request.user!.companyId };
    if (query.status) where.status = query.status;
    if (query.search) where.name = { contains: query.search, mode: 'insensitive' };

    // If manager, show only assigned sites
    if (request.user!.role === 'MANAGER') {
      where.managers = { some: { userId: request.user!.id } };
    }
    if (request.user!.role === 'CLIENT') {
      where.clients = { some: { userId: request.user!.id } };
    }

    const [data, total] = await Promise.all([
      app.prisma.site.findMany({
        where,
        include: {
          _count: { select: { workers: true, submissions: true, zones: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate(query),
      }),
      app.prisma.site.count({ where }),
    ]);
    return paginatedResponse(data, total, query);
  });

  app.post('/', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = createSiteSchema.parse(request.body);
    const site = await app.prisma.site.create({
      data: { companyId: request.user!.companyId, ...body },
    });
    return reply.code(201).send(site);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const where: any = { id, companyId: request.user!.companyId };
    // Managers can only view sites they're assigned to
    if (request.user!.role === 'MANAGER') {
      where.managers = { some: { userId: request.user!.id } };
    }
    // Clients can only view sites they're assigned to
    if (request.user!.role === 'CLIENT') {
      where.clients = { some: { userId: request.user!.id } };
    }
    const site = await app.prisma.site.findFirst({
      where,
      include: {
        zones: { orderBy: { sortOrder: 'asc' } },
        siteWorkTypes: { include: { workType: true } },
        workers: { include: { worker: { select: { id: true, name: true, phone: true, status: true } } } },
        managers: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        clients: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        _count: { select: { submissions: true, issues: true, alerts: true } },
      },
    });
    if (!site) return reply.code(404).send({ error: 'Site not found' });
    return site;
  });

  app.put('/:id', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const body = updateSiteSchema.parse(request.body);
    const result = await app.prisma.site.updateMany({
      where: { id, companyId: request.user!.companyId },
      data: body,
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Site not found' });
    return app.prisma.site.findUnique({ where: { id } });
  });

  app.put('/:id/archive', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const result = await app.prisma.site.updateMany({
      where: { id, companyId: request.user!.companyId },
      data: { status: 'ARCHIVED' },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Site not found' });
    return { message: 'Site archived' };
  });

  // Zones
  app.get('/:id/zones', async (request, reply) => {
    const { id } = request.params as { id: string };
    const site = await app.prisma.site.findFirst({
      where: { id, companyId: request.user!.companyId },
      select: { id: true },
    });
    if (!site) return reply.code(404).send({ error: 'Site not found' });
    const zones = await app.prisma.zone.findMany({
      where: { siteId: id },
      orderBy: { sortOrder: 'asc' },
    });
    return zones;
  });

  app.post('/:id/zones', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage site zones' });
    }
    const { id } = request.params as { id: string };
    const body = z.object({ name: z.string().max(255), sortOrder: z.number().int().default(0) }).parse(request.body);
    const zone = await app.prisma.zone.create({ data: { siteId: id, ...body } });
    return reply.code(201).send(zone);
  });

  app.put('/:id/zones/:zoneId', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage site zones' });
    }
    const { zoneId } = request.params as { id: string; zoneId: string };
    const body = z.object({ name: z.string().max(255).optional(), sortOrder: z.number().int().optional() }).parse(request.body);
    return app.prisma.zone.update({ where: { id: zoneId }, data: body });
  });

  app.delete('/:id/zones/:zoneId', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage site zones' });
    }
    const { zoneId } = request.params as { id: string; zoneId: string };
    await app.prisma.zone.delete({ where: { id: zoneId } });
    return { message: 'Zone deleted' };
  });

  // Work types
  app.post('/:id/work-types', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage site work types' });
    }
    const { id } = request.params as { id: string };
    const { workTypeId } = z.object({ workTypeId: z.string().uuid() }).parse(request.body);
    const swt = await app.prisma.siteWorkType.create({ data: { siteId: id, workTypeId } });
    return reply.code(201).send(swt);
  });

  app.delete('/:id/work-types/:workTypeId', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage site work types' });
    }
    const { id, workTypeId } = request.params as { id: string; workTypeId: string };
    await app.prisma.siteWorkType.deleteMany({ where: { siteId: id, workTypeId } });
    return { message: 'Work type removed from site' };
  });

  // Workers assignment
  app.get('/:id/workers', async (request, reply) => {
    const { id } = request.params as { id: string };
    const site = await app.prisma.site.findFirst({
      where: { id, companyId: request.user!.companyId },
      select: { id: true },
    });
    if (!site) return reply.code(404).send({ error: 'Site not found' });
    const workers = await app.prisma.siteWorker.findMany({
      where: { siteId: id },
      include: { worker: { select: { id: true, name: true, phone: true, status: true } } },
    });
    return workers;
  });

  app.post('/:id/workers', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can assign workers to sites' });
    }
    const { id } = request.params as { id: string };
    const { workerId } = z.object({ workerId: z.string().uuid() }).parse(request.body);
    const sw = await app.prisma.siteWorker.create({ data: { siteId: id, workerId } });
    return reply.code(201).send(sw);
  });

  app.delete('/:id/workers/:workerId', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can remove workers from sites' });
    }
    const { id, workerId } = request.params as { id: string; workerId: string };
    await app.prisma.siteWorker.deleteMany({ where: { siteId: id, workerId } });
    return { message: 'Worker removed from site' };
  });

  // Managers assignment
  app.get('/:id/managers', async (request, reply) => {
    const { id } = request.params as { id: string };
    const site = await app.prisma.site.findFirst({
      where: { id, companyId: request.user!.companyId },
      select: { id: true },
    });
    if (!site) return reply.code(404).send({ error: 'Site not found' });
    const managers = await app.prisma.siteManager.findMany({
      where: { siteId: id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    return managers;
  });

  app.post('/:id/managers', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can assign managers to sites' });
    }
    const { id } = request.params as { id: string };
    const { userId } = z.object({ userId: z.string().uuid() }).parse(request.body);
    const sm = await app.prisma.siteManager.create({ data: { siteId: id, userId } });
    return reply.code(201).send(sm);
  });

  app.delete('/:id/managers/:userId', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can remove managers from sites' });
    }
    const { id, userId } = request.params as { id: string; userId: string };
    await app.prisma.siteManager.deleteMany({ where: { siteId: id, userId } });
    return { message: 'Manager removed from site' };
  });

  // Clients assignment
  app.get('/:id/clients', async (request, reply) => {
    const { id } = request.params as { id: string };
    const site = await app.prisma.site.findFirst({
      where: { id, companyId: request.user!.companyId },
      select: { id: true },
    });
    if (!site) return reply.code(404).send({ error: 'Site not found' });
    const clients = await app.prisma.siteClient.findMany({
      where: { siteId: id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    return clients;
  });

  app.post('/:id/clients', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can assign clients to sites' });
    }
    const { id } = request.params as { id: string };
    const { userId } = z.object({ userId: z.string().uuid() }).parse(request.body);
    const sc = await app.prisma.siteClient.create({ data: { siteId: id, userId } });
    return reply.code(201).send(sc);
  });

  app.delete('/:id/clients/:userId', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can remove clients from sites' });
    }
    const { id, userId } = request.params as { id: string; userId: string };
    await app.prisma.siteClient.deleteMany({ where: { siteId: id, userId } });
    return { message: 'Client removed from site' };
  });
}

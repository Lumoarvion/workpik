import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination.js';

const listAlertsQuery = paginationSchema.extend({
  siteId: z.string().uuid().optional(),
  alertType: z.string().optional(),
  isRead: z.coerce.boolean().optional(),
});

export async function alertRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const query = listAlertsQuery.parse(request.query);
    const siteFilter: any = { companyId: request.user!.companyId };
    if (request.user!.role === 'MANAGER') {
      siteFilter.managers = { some: { userId: request.user!.id } };
    }
    if (request.user!.role === 'CLIENT') {
      siteFilter.clients = { some: { userId: request.user!.id } };
    }
    const where: any = { site: siteFilter };
    if (query.siteId) where.siteId = query.siteId;
    if (query.alertType) where.alertType = query.alertType;
    if (query.isRead !== undefined) where.isRead = query.isRead;

    const [data, total] = await Promise.all([
      app.prisma.alert.findMany({
        where,
        include: { site: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        ...paginate(query),
      }),
      app.prisma.alert.count({ where }),
    ]);
    return paginatedResponse(data, total, query);
  });

  // Static routes MUST come before parameterized routes
  app.put('/read-all', async (request) => {
    await app.prisma.alert.updateMany({
      where: { site: { companyId: request.user!.companyId }, isRead: false },
      data: { isRead: true },
    });
    return { message: 'All alerts marked as read' };
  });

  app.get('/summary', async (request) => {
    const alerts = await app.prisma.alert.groupBy({
      by: ['alertType'],
      where: { site: { companyId: request.user!.companyId }, isRead: false },
      _count: true,
    });
    const summary: Record<string, number> = {};
    for (const a of alerts) summary[a.alertType] = a._count;
    return summary;
  });

  // Parameterized routes
  app.put('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await app.prisma.alert.updateMany({
      where: { id, site: { companyId: request.user!.companyId } },
      data: { isRead: true },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Alert not found' });
    return { message: 'Marked as read' };
  });

  // GPS override — mark a GPS mismatch submission as reviewed-and-OK
  app.put('/:id/gps-override', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { note } = z.object({ note: z.string().min(20, 'Note must be at least 20 characters') }).parse(request.body);

    const alert = await app.prisma.alert.findFirst({
      where: { id, site: { companyId: request.user!.companyId }, alertType: 'gps_mismatch' },
      include: { site: { select: { id: true, name: true } } },
    });
    if (!alert) return reply.code(404).send({ error: 'Alert not found' });

    // Fetch reviewer name
    const reviewer = await app.prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { fullName: true },
    });

    const existingMeta = (alert.metadata as Record<string, any>) || {};
    const updatedMeta = {
      ...existingMeta,
      gpsOverride: {
        note,
        overriddenBy: request.user!.id,
        overriddenByName: reviewer?.fullName || 'Unknown',
        overriddenAt: new Date().toISOString(),
      },
    };

    await app.prisma.alert.update({
      where: { id },
      data: { isRead: true, metadata: updatedMeta },
    });

    return { message: 'GPS override recorded', override: updatedMeta.gpsOverride };
  });
}

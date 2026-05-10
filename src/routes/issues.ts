import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination.js';

const listIssuesQuery = paginationSchema.extend({
  siteId: z.string().uuid().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function issueRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const query = listIssuesQuery.parse(request.query);
    const siteFilter: any = { companyId: request.user!.companyId };
    if (request.user!.role === 'MANAGER') {
      siteFilter.managers = { some: { userId: request.user!.id } };
    }
    if (request.user!.role === 'CLIENT') {
      siteFilter.clients = { some: { userId: request.user!.id } };
    }
    const where: any = { site: siteFilter };
    if (query.siteId) where.siteId = query.siteId;
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo + 'T23:59:59.999Z');
    }

    const [data, total] = await Promise.all([
      app.prisma.issue.findMany({
        where,
        include: {
          site: { select: { id: true, name: true } },
          worker: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate(query),
      }),
      app.prisma.issue.count({ where }),
    ]);
    return paginatedResponse(data, total, query);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const issue = await app.prisma.issue.findFirst({
      where: { id, site: { companyId: request.user!.companyId } },
      include: {
        site: { select: { id: true, name: true } },
        worker: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!issue) return reply.code(404).send({ error: 'Issue not found' });

    if (issue.photoUrl) issue.photoUrl = await app.s3.getSignedUrl(issue.photoUrl);
    if (issue.resolutionPhotoUrl) issue.resolutionPhotoUrl = await app.s3.getSignedUrl(issue.resolutionPhotoUrl);
    return issue;
  });

  app.put('/:id/acknowledge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await app.prisma.issue.updateMany({
      where: { id, site: { companyId: request.user!.companyId }, status: 'OPEN' },
      data: { status: 'ACKNOWLEDGED' },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Issue not found or already acknowledged' });
    return { message: 'Issue acknowledged' };
  });

  app.put('/:id/respond', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { response } = z.object({ response: z.string().min(1) }).parse(request.body);
    const result = await app.prisma.issue.updateMany({
      where: { id, site: { companyId: request.user!.companyId } },
      data: { response, respondedBy: request.user!.id, respondedAt: new Date() },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Issue not found' });
    return { message: 'Response added' };
  });

  app.put('/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      resolutionNote: z.string().min(5, 'Resolution note must be at least 5 characters'),
      resolutionPhotoUrl: z.string().optional(),
    }).parse(request.body);

    // Fetch resolver name for audit
    const resolver = await app.prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { fullName: true },
    });

    const result = await app.prisma.issue.updateMany({
      where: { id, site: { companyId: request.user!.companyId } },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionPhotoUrl: body.resolutionPhotoUrl,
        // Store resolution note + resolver in response field (prefixed so it's distinguishable)
        response: `[RESOLVED by ${resolver?.fullName || 'Unknown'}] ${body.resolutionNote}`,
        respondedBy: request.user!.id,
        respondedAt: new Date(),
      },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Issue not found' });
    return { message: 'Issue resolved' };
  });
}

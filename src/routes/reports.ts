import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination.js';
import { generateReportPdf } from '../services/pdfGenerator.js';

const generateReportSchema = z.object({
  siteId: z.string().uuid(),
  reportType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  date: z.string(), // ISO date string
});

const listReportsQuery = paginationSchema.extend({
  siteId: z.string().uuid().optional(),
  reportType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function reportRoutes(app: FastifyInstance) {
  // Public route for shared reports
  app.get('/share/:shareToken', async (request, reply) => {
    const { shareToken } = request.params as { shareToken: string };
    const report = await app.prisma.report.findUnique({
      where: { shareToken },
      include: {
        site: { select: { name: true, address: true } },
        company: { select: { name: true, logo: true } },
      },
    });
    if (!report) return reply.code(404).send({ error: 'Report not found' });
    return report;
  });

  // Authenticated routes
  app.register(async (authApp) => {
    authApp.addHook('preHandler', app.authenticate);

    authApp.get('/', async (request) => {
      const query = listReportsQuery.parse(request.query);
      const where: any = { companyId: request.user!.companyId };
      if (query.siteId) where.siteId = query.siteId;
      if (query.reportType) where.reportType = query.reportType;
      if (query.dateFrom || query.dateTo) {
        where.reportDate = {};
        if (query.dateFrom) where.reportDate.gte = new Date(query.dateFrom);
        if (query.dateTo) where.reportDate.lte = new Date(query.dateTo);
      }

      const [data, total] = await Promise.all([
        app.prisma.report.findMany({
          where,
          include: { site: { select: { id: true, name: true } } },
          orderBy: { reportDate: 'desc' },
          ...paginate(query),
        }),
        app.prisma.report.count({ where }),
      ]);
      return paginatedResponse(data, total, query);
    });

    authApp.get('/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const report = await app.prisma.report.findFirst({
        where: { id, companyId: request.user!.companyId },
        include: {
          site: { select: { name: true, address: true } },
          company: { select: { name: true, logo: true } },
        },
      });
      if (!report) return reply.code(404).send({ error: 'Report not found' });
      return report;
    });

    authApp.get('/:id/pdf', async (request, reply) => {
      const { id } = request.params as { id: string };

      // Fetch the report with site + company
      const report = await app.prisma.report.findFirst({
        where: { id, companyId: request.user!.companyId },
        include: {
          site: { select: { name: true, address: true } },
          company: { select: { name: true, logo: true } },
        },
      });
      if (!report) return reply.code(404).send({ error: 'Report not found' });

      const reportData = report.data as any;

      // Resolve worker IDs → names
      const workerIds: string[] = (reportData.workerStats || []).map((w: any) => w.workerId);
      const workTypeIds: string[] = (reportData.workTypeStats || []).map((w: any) => w.workTypeId);

      const [workers, workTypes, gpsData] = await Promise.all([
        workerIds.length > 0
          ? app.prisma.worker.findMany({
              where: { id: { in: workerIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        workTypeIds.length > 0
          ? app.prisma.workType.findMany({
              where: { id: { in: workTypeIds } },
              select: { id: true, name: true, trade: true },
            })
          : Promise.resolve([]),
        // GPS compliance: count within-radius submissions in this period
        app.prisma.submission.aggregate({
          where: {
            siteId: report.siteId,
            createdAt: {
              gte: report.periodStart,
              lte: new Date(report.periodEnd.getTime() + 86400000),
            },
          },
          _count: { _all: true },
        }).then(async (total) => {
          if (total._count._all === 0) return 100;
          const within = await app.prisma.submission.count({
            where: {
              siteId: report.siteId,
              isWithinRadius: true,
              createdAt: {
                gte: report.periodStart,
                lte: new Date(report.periodEnd.getTime() + 86400000),
              },
            },
          });
          return Math.round((within / total._count._all) * 100);
        }),
      ]);

      const workerMap = new Map(workers.map((w) => [w.id, w.name]));
      const workTypeMap = new Map(workTypes.map((w) => [w.id, { name: w.name, trade: w.trade }]));

      // Prisma groupBy with _count: true stores { _count: { _all: N } }
      // but JSON serialization may flatten it — handle both shapes
      const extractCount = (w: any): number => {
        if (typeof w._count === 'number') return w._count;
        if (typeof w._count === 'object' && w._count !== null) return w._count._all ?? 0;
        return 0;
      };

      const workerBreakdown = (reportData.workerStats || []).map((w: any) => ({
        name: workerMap.get(w.workerId) || 'Unknown Worker',
        count: extractCount(w),
      }));

      const workTypeBreakdown = (reportData.workTypeStats || []).map((w: any) => ({
        name: workTypeMap.get(w.workTypeId)?.name || 'Unknown Work Type',
        trade: workTypeMap.get(w.workTypeId)?.trade || null,
        count: extractCount(w),
      }));

      const pdfBuffer = await generateReportPdf({
        company: { name: report.company.name, logo: report.company.logo },
        site: { name: report.site.name, address: report.site.address },
        reportType: report.reportType as any,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        reportDate: report.reportDate,
        stats: {
          totalSubmissions: reportData.totalSubmissions ?? 0,
          issueCount: reportData.issueCount ?? 0,
          activeWorkers: workerIds.length,
          gpsComplianceRate: gpsData,
        },
        workerBreakdown,
        workTypeBreakdown,
      });

      const siteName = report.site.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = report.reportDate.toISOString().split('T')[0];
      const filename = `report_${siteName}_${report.reportType.toLowerCase()}_${dateStr}.pdf`;

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .header('Content-Length', pdfBuffer.length)
        .send(pdfBuffer);
    });

    authApp.post('/generate', async (request, reply) => {
      const body = generateReportSchema.parse(request.body);
      const site = await app.prisma.site.findFirst({
        where: { id: body.siteId, companyId: request.user!.companyId },
      });
      if (!site) return reply.code(404).send({ error: 'Site not found' });

      const reportDate = new Date(body.date);
      let periodStart: Date, periodEnd: Date;

      if (body.reportType === 'DAILY') {
        periodStart = new Date(body.date);
        periodEnd = new Date(body.date);
      } else if (body.reportType === 'WEEKLY') {
        periodStart = new Date(body.date);
        periodEnd = new Date(periodStart.getTime() + 6 * 86400000); // Mon-Sun (7 days inclusive)
      } else {
        periodStart = new Date(reportDate.getFullYear(), reportDate.getMonth(), 1);
        periodEnd = new Date(reportDate.getFullYear(), reportDate.getMonth() + 1, 0);
      }

      // Aggregate data
      const [totalSubs, workerStats, workTypeStats, issues] = await Promise.all([
        app.prisma.submission.count({
          where: { siteId: body.siteId, createdAt: { gte: periodStart, lte: new Date(periodEnd.getTime() + 86400000) } },
        }),
        app.prisma.submission.groupBy({
          by: ['workerId'],
          where: { siteId: body.siteId, createdAt: { gte: periodStart, lte: new Date(periodEnd.getTime() + 86400000) } },
          _count: true,
        }),
        app.prisma.submission.groupBy({
          by: ['workTypeId'],
          where: { siteId: body.siteId, createdAt: { gte: periodStart, lte: new Date(periodEnd.getTime() + 86400000) } },
          _count: true,
        }),
        app.prisma.issue.count({
          where: { siteId: body.siteId, createdAt: { gte: periodStart, lte: new Date(periodEnd.getTime() + 86400000) } },
        }),
      ]);

      const report = await app.prisma.report.create({
        data: {
          companyId: request.user!.companyId,
          siteId: body.siteId,
          reportType: body.reportType,
          reportDate,
          periodStart,
          periodEnd,
          data: { totalSubmissions: totalSubs, workerStats, workTypeStats, issueCount: issues },
          shareToken: crypto.randomBytes(32).toString('hex'),
          deliveryStatus: 'GENERATED',
          deliveredTo: [],
        },
        include: { site: { select: { name: true } } },
      });

      return reply.code(201).send(report);
    });

    authApp.post('/:id/send', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { emails } = z.object({ emails: z.array(z.string().email()) }).parse(request.body);
      const report = await app.prisma.report.findFirst({
        where: { id, companyId: request.user!.companyId },
      });
      if (!report) return reply.code(404).send({ error: 'Report not found' });

      // In production, this would send emails via Resend
      await app.prisma.report.update({
        where: { id },
        data: { deliveryStatus: 'SENT', deliveredTo: emails },
      });
      return { message: `Report would be sent to ${emails.join(', ')}` };
    });
  });
}

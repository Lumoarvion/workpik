"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRoutes = dashboardRoutes;
async function dashboardRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    app.get('/', async (request) => {
        const companyId = request.user.companyId;
        const { date } = request.query;
        const dayStart = date ? new Date(date) : new Date();
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        // Keep backward-compat name for use below
        const todayStart = dayStart;
        const siteWhere = { companyId };
        if (request.user.role === 'MANAGER') {
            siteWhere.managers = { some: { userId: request.user.id } };
        }
        if (request.user.role === 'CLIENT') {
            siteWhere.clients = { some: { userId: request.user.id } };
        }
        const sites = await app.prisma.site.findMany({
            where: { ...siteWhere, status: 'ACTIVE' },
            select: { id: true, name: true, minPhotosPerDay: true },
        });
        const siteIds = sites.map((s) => s.id);
        const [todaySubmissions, activeWorkers, openIssues, urgentIssues, recentActivity, unreadAlerts] = await Promise.all([
            app.prisma.submission.count({
                where: { siteId: { in: siteIds }, createdAt: { gte: todayStart, lte: dayEnd } },
            }),
            app.prisma.submission.findMany({
                where: { siteId: { in: siteIds }, createdAt: { gte: todayStart, lte: dayEnd } },
                select: { workerId: true },
                distinct: ['workerId'],
            }),
            app.prisma.issue.count({
                where: { siteId: { in: siteIds }, status: { not: 'RESOLVED' } },
            }),
            app.prisma.issue.count({
                where: { siteId: { in: siteIds }, status: 'OPEN', severity: 'URGENT' },
            }),
            app.prisma.submission.findMany({
                where: { siteId: { in: siteIds } },
                include: {
                    site: { select: { name: true } },
                    worker: { select: { name: true } },
                    workType: { select: { name: true } },
                    photos: { select: { thumbnailUrl: true }, take: 1, orderBy: { sortOrder: 'asc' } },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
            app.prisma.alert.findMany({
                where: { siteId: { in: siteIds }, isRead: false },
                include: { site: { select: { name: true } } },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);
        // Total assigned workers
        const totalWorkers = await app.prisma.siteWorker.findMany({
            where: { siteId: { in: siteIds } },
            select: { workerId: true },
            distinct: ['workerId'],
        });
        // Per-site submission counts
        const siteSubmissions = await app.prisma.submission.groupBy({
            by: ['siteId'],
            where: { siteId: { in: siteIds }, createdAt: { gte: todayStart, lte: dayEnd } },
            _count: true,
        });
        const siteWorkerActivity = await app.prisma.submission.groupBy({
            by: ['siteId', 'workerId'],
            where: { siteId: { in: siteIds }, createdAt: { gte: todayStart, lte: dayEnd } },
        });
        const siteCountMap = new Map(siteSubmissions.map((s) => [s.siteId, s._count]));
        const siteActiveWorkers = new Map();
        for (const sw of siteWorkerActivity) {
            siteActiveWorkers.set(sw.siteId, (siteActiveWorkers.get(sw.siteId) || 0) + 1);
        }
        return {
            today: {
                totalSubmissions: todaySubmissions,
                activeWorkers: activeWorkers.length,
                inactiveWorkers: totalWorkers.length - activeWorkers.length,
                totalSites: sites.length,
                activeSites: siteSubmissions.length,
                issuesReported: openIssues,
                urgentIssues,
            },
            sitesSummary: sites.map((s) => ({
                siteId: s.id,
                siteName: s.name,
                submissionCount: siteCountMap.get(s.id) || 0,
                activeWorkerCount: siteActiveWorkers.get(s.id) || 0,
                minPhotosExpected: s.minPhotosPerDay,
                minPhotosMet: (siteCountMap.get(s.id) || 0) >= s.minPhotosPerDay,
            })),
            recentActivity: recentActivity.map((s) => ({
                id: s.id,
                siteName: s.site.name,
                workerName: s.worker.name,
                workType: s.workType.name,
                time: s.createdAt,
                thumbnailUrl: s.photos[0]?.thumbnailUrl,
            })),
            alerts: unreadAlerts.map((a) => ({
                id: a.id,
                type: a.alertType,
                title: a.title,
                siteName: a.site.name,
                time: a.createdAt,
            })),
        };
    });
    // ── Trade-wise progress ──────────────────────────────────────────────────────
    app.get('/trade-progress', async (request) => {
        const companyId = request.user.companyId;
        const siteWhere = { companyId, status: 'ACTIVE' };
        if (request.user.role === 'MANAGER')
            siteWhere.managers = { some: { userId: request.user.id } };
        if (request.user.role === 'CLIENT')
            siteWhere.clients = { some: { userId: request.user.id } };
        const sites = await app.prisma.site.findMany({ where: siteWhere, select: { id: true } });
        const siteIds = sites.map((s) => s.id);
        if (siteIds.length === 0)
            return [];
        const submissions = await app.prisma.submission.findMany({
            where: { siteId: { in: siteIds } },
            select: {
                customData: true,
                workType: { select: { trade: true, billingUnit: true, name: true } },
            },
        });
        // Aggregate by trade
        const tradeMap = new Map();
        for (const sub of submissions) {
            const trade = sub.workType.trade || 'General';
            const unit = sub.workType.billingUnit || '';
            if (!tradeMap.has(trade)) {
                tradeMap.set(trade, { totalQty: 0, submissionsWithQty: 0, totalSubmissions: 0, unit, workTypes: new Set() });
            }
            const entry = tradeMap.get(trade);
            entry.totalSubmissions++;
            entry.workTypes.add(sub.workType.name);
            if (!entry.unit && unit)
                entry.unit = unit;
            const cd = sub.customData;
            if (cd?.quantity && typeof cd.quantity === 'number') {
                entry.totalQty += cd.quantity;
                entry.submissionsWithQty++;
            }
        }
        return Array.from(tradeMap.entries())
            .map(([trade, d]) => ({
            trade,
            totalQty: Math.round(d.totalQty * 100) / 100,
            unit: d.unit,
            submissionsWithQty: d.submissionsWithQty,
            totalSubmissions: d.totalSubmissions,
            workTypeCount: d.workTypes.size,
        }))
            .sort((a, b) => b.totalSubmissions - a.totalSubmissions);
    });
    app.get('/site/:siteId', async (request, reply) => {
        const { siteId } = request.params;
        const siteWhere = { id: siteId, companyId: request.user.companyId };
        // MANAGER/CLIENT can only view assigned sites
        if (request.user.role === 'MANAGER') {
            siteWhere.managers = { some: { userId: request.user.id } };
        }
        if (request.user.role === 'CLIENT') {
            siteWhere.clients = { some: { userId: request.user.id } };
        }
        const site = await app.prisma.site.findFirst({ where: siteWhere });
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [todaySubs, todayIssues, workers, zoneCoverage, recentSubs] = await Promise.all([
            app.prisma.submission.count({ where: { siteId, createdAt: { gte: todayStart } } }),
            app.prisma.issue.count({ where: { siteId, status: { not: 'RESOLVED' } } }),
            app.prisma.siteWorker.findMany({
                where: { siteId },
                include: {
                    worker: {
                        select: { id: true, name: true },
                    },
                },
            }),
            app.prisma.submission.groupBy({
                by: ['zoneId'],
                where: { siteId, createdAt: { gte: todayStart }, zoneId: { not: null } },
                _count: true,
            }),
            app.prisma.submission.findMany({
                where: { siteId },
                include: {
                    worker: { select: { name: true } },
                    workType: { select: { name: true } },
                    photos: { select: { thumbnailUrl: true }, take: 1 },
                    zone: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
        ]);
        // Worker activity
        const workerSubs = await app.prisma.submission.groupBy({
            by: ['workerId'],
            where: { siteId, createdAt: { gte: todayStart } },
            _count: true,
            _max: { createdAt: true },
        });
        const workerSubMap = new Map(workerSubs.map((w) => [w.workerId, w]));
        // Zone names
        const zones = await app.prisma.zone.findMany({ where: { siteId } });
        const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
        const activeWorkerIds = new Set(workerSubs.map((w) => w.workerId));
        return {
            today: {
                submissions: todaySubs,
                activeWorkers: activeWorkerIds.size,
                zonesCovered: zoneCoverage.length,
                issues: todayIssues,
            },
            workerActivity: workers.map((w) => {
                const sub = workerSubMap.get(w.workerId);
                return {
                    workerId: w.workerId,
                    name: w.worker.name,
                    submissionCount: sub?._count || 0,
                    lastActiveTime: sub?._max?.createdAt || null,
                };
            }),
            zoneCoverage: zoneCoverage.map((z) => ({
                zoneId: z.zoneId,
                zoneName: zoneMap.get(z.zoneId) || 'Unknown',
                submissionCount: z._count,
            })),
            recentSubmissions: recentSubs.map((s) => ({
                id: s.id,
                workerName: s.worker.name,
                workType: s.workType.name,
                zone: s.zone?.name,
                time: s.createdAt,
                thumbnailUrl: s.photos[0]?.thumbnailUrl,
            })),
        };
    });
}
//# sourceMappingURL=dashboard.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionRoutes = submissionRoutes;
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const pagination_js_1 = require("../utils/pagination.js");
const listSubmissionsQuery = pagination_js_1.paginationSchema.extend({
    siteId: zod_1.z.string().uuid().optional(),
    workerId: zod_1.z.string().uuid().optional(),
    workTypeId: zod_1.z.string().uuid().optional(),
    zoneId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.enum(['PENDING_SYNC', 'SUBMITTED', 'FLAGGED', 'RETAKE_REQUESTED']).optional(),
    dateFrom: zod_1.z.string().optional(),
    dateTo: zod_1.z.string().optional(),
});
async function submissionRoutes(app) {
    // Public share route — no auth required
    app.get('/share/:shareToken', async (request, reply) => {
        const { shareToken } = request.params;
        const link = await app.prisma.submissionShareLink.findUnique({
            where: { shareToken },
            include: {
                submission: {
                    include: {
                        photos: { orderBy: { sortOrder: 'asc' } },
                        site: { select: { id: true, name: true } },
                        worker: { select: { id: true, name: true } },
                        workType: { select: { id: true, name: true, icon: true, customFields: true, photoSteps: true } },
                        zone: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!link)
            return reply.code(404).send({ error: 'Share link not found' });
        if (link.expiresAt && link.expiresAt < new Date()) {
            return reply.code(410).send({ error: 'Share link has expired' });
        }
        // Sign photo URLs
        for (const photo of link.submission.photos) {
            if (photo.photoUrl)
                photo.photoUrl = await app.s3.getSignedUrl(photo.photoUrl);
            if (photo.thumbnailUrl)
                photo.thumbnailUrl = await app.s3.getSignedUrl(photo.thumbnailUrl);
        }
        // Get company info for branding
        const site = await app.prisma.site.findUnique({
            where: { id: link.submission.siteId },
            include: { company: { select: { name: true, logo: true } } },
        });
        return {
            ...link.submission,
            company: site?.company ? { name: site.company.name, logo: site.company.logo } : null,
        };
    });
    app.addHook('preHandler', app.authenticate);
    // --- Static routes MUST come before parameterized routes ---
    app.get('/stats', async (request) => {
        const query = zod_1.z.object({
            siteId: zod_1.z.string().uuid().optional(),
            dateFrom: zod_1.z.string().optional(),
            dateTo: zod_1.z.string().optional(),
        }).parse(request.query);
        const where = { site: { companyId: request.user.companyId } };
        if (query.siteId)
            where.siteId = query.siteId;
        if (query.dateFrom || query.dateTo) {
            where.createdAt = {};
            if (query.dateFrom)
                where.createdAt.gte = new Date(query.dateFrom);
            if (query.dateTo)
                where.createdAt.lte = new Date(query.dateTo + 'T23:59:59.999Z');
        }
        const [total, byStatus, gpsStats] = await Promise.all([
            app.prisma.submission.count({ where }),
            app.prisma.submission.groupBy({ by: ['status'], where, _count: true }),
            app.prisma.submission.aggregate({
                where,
                _count: { _all: true, isWithinRadius: true },
            }),
        ]);
        const withinRadius = await app.prisma.submission.count({ where: { ...where, isWithinRadius: true } });
        const gpsComplianceRate = total > 0 ? Math.round((withinRadius / total) * 100) : 100;
        return { totalSubmissions: total, byStatus, gpsComplianceRate };
    });
    app.get('/map-data', async (request) => {
        const query = zod_1.z.object({
            siteId: zod_1.z.string().uuid().optional(),
            date: zod_1.z.string().optional(),
        }).parse(request.query);
        const where = { site: { companyId: request.user.companyId } };
        if (query.siteId)
            where.siteId = query.siteId;
        if (query.date) {
            const d = new Date(query.date);
            where.createdAt = {
                gte: d,
                lte: new Date(d.getTime() + 86400000),
            };
        }
        const submissions = await app.prisma.submission.findMany({
            where,
            select: {
                id: true,
                latitude: true,
                longitude: true,
                createdAt: true,
                worker: { select: { name: true } },
                workType: { select: { name: true } },
                photos: { select: { thumbnailUrl: true }, take: 1 },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        return submissions.map((s) => ({
            id: s.id,
            lat: s.latitude,
            lng: s.longitude,
            workerName: s.worker.name,
            workType: s.workType.name,
            time: s.createdAt,
            thumbnailUrl: s.photos[0]?.thumbnailUrl,
        }));
    });
    // --- List route ---
    app.get('/', async (request) => {
        const query = listSubmissionsQuery.parse(request.query);
        const where = {};
        // Scope to company's sites
        where.site = { companyId: request.user.companyId };
        if (request.user.role === 'MANAGER') {
            where.site.managers = { some: { userId: request.user.id } };
        }
        if (request.user.role === 'CLIENT') {
            where.site.clients = { some: { userId: request.user.id } };
        }
        if (query.siteId)
            where.siteId = query.siteId;
        if (query.workerId)
            where.workerId = query.workerId;
        if (query.workTypeId)
            where.workTypeId = query.workTypeId;
        if (query.zoneId)
            where.zoneId = query.zoneId;
        if (query.status)
            where.status = query.status;
        if (query.dateFrom || query.dateTo) {
            where.createdAt = {};
            if (query.dateFrom)
                where.createdAt.gte = new Date(query.dateFrom);
            if (query.dateTo)
                where.createdAt.lte = new Date(query.dateTo + 'T23:59:59.999Z');
        }
        const [data, total] = await Promise.all([
            app.prisma.submission.findMany({
                where,
                include: {
                    photos: { select: { id: true, thumbnailUrl: true, photoUrl: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
                    site: { select: { id: true, name: true } },
                    worker: { select: { id: true, name: true } },
                    workType: { select: { id: true, name: true, icon: true, trade: true, billingUnit: true } },
                    zone: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                ...(0, pagination_js_1.paginate)(query),
            }),
            app.prisma.submission.count({ where }),
        ]);
        return (0, pagination_js_1.paginatedResponse)(data, total, query);
    });
    // --- Parameterized routes ---
    app.get('/:id', async (request, reply) => {
        const { id } = request.params;
        const sub = await app.prisma.submission.findFirst({
            where: { id, site: { companyId: request.user.companyId } },
            include: {
                photos: { orderBy: { sortOrder: 'asc' } },
                site: { select: { id: true, name: true, latitude: true, longitude: true, gpsRadiusMetres: true } },
                worker: { select: { id: true, name: true, phone: true } },
                workType: { select: { id: true, name: true, icon: true, billingUnit: true, trade: true, customFields: true, photoSteps: true } },
                zone: { select: { id: true, name: true } },
            },
        });
        if (!sub)
            return reply.code(404).send({ error: 'Submission not found' });
        // Sign photo URLs
        for (const photo of sub.photos) {
            if (photo.photoUrl)
                photo.photoUrl = await app.s3.getSignedUrl(photo.photoUrl);
            if (photo.thumbnailUrl)
                photo.thumbnailUrl = await app.s3.getSignedUrl(photo.thumbnailUrl);
        }
        // Resolve reviewer name (flaggedBy is a bare UUID, not a Prisma relation)
        let flaggedByName = null;
        if (sub.flaggedBy) {
            const reviewer = await app.prisma.user.findUnique({
                where: { id: sub.flaggedBy },
                select: { fullName: true },
            });
            flaggedByName = reviewer?.fullName || null;
        }
        return { ...sub, flaggedByName };
    });
    // Create share link
    app.post('/:id/share', async (request, reply) => {
        const { id } = request.params;
        const sub = await app.prisma.submission.findFirst({
            where: { id, site: { companyId: request.user.companyId } },
        });
        if (!sub)
            return reply.code(404).send({ error: 'Submission not found' });
        const shareToken = crypto_1.default.randomBytes(32).toString('hex');
        const link = await app.prisma.submissionShareLink.create({
            data: { submissionId: id, shareToken },
        });
        return { shareToken: link.shareToken, shareUrl: `/share/submissions/${link.shareToken}` };
    });
    app.put('/:id/flag', async (request, reply) => {
        const { id } = request.params;
        const { reason } = zod_1.z.object({ reason: zod_1.z.string().min(1) }).parse(request.body);
        const result = await app.prisma.submission.updateMany({
            where: { id, site: { companyId: request.user.companyId } },
            data: { status: 'FLAGGED', flagReason: reason, flaggedBy: request.user.id },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Submission not found' });
        return { message: 'Submission flagged' };
    });
    app.put('/:id/unflag', async (request, reply) => {
        const { id } = request.params;
        const result = await app.prisma.submission.updateMany({
            where: { id, site: { companyId: request.user.companyId } },
            data: { status: 'SUBMITTED', flagReason: null, flaggedBy: null },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Submission not found' });
        return { message: 'Flag removed' };
    });
}
//# sourceMappingURL=submissions.js.map
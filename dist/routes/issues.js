"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueRoutes = issueRoutes;
const zod_1 = require("zod");
const pagination_js_1 = require("../utils/pagination.js");
const listIssuesQuery = pagination_js_1.paginationSchema.extend({
    siteId: zod_1.z.string().uuid().optional(),
    severity: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    status: zod_1.z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
    dateFrom: zod_1.z.string().optional(),
    dateTo: zod_1.z.string().optional(),
});
async function issueRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    app.get('/', async (request) => {
        const query = listIssuesQuery.parse(request.query);
        const siteFilter = { companyId: request.user.companyId };
        if (request.user.role === 'MANAGER') {
            siteFilter.managers = { some: { userId: request.user.id } };
        }
        if (request.user.role === 'CLIENT') {
            siteFilter.clients = { some: { userId: request.user.id } };
        }
        const where = { site: siteFilter };
        if (query.siteId)
            where.siteId = query.siteId;
        if (query.severity)
            where.severity = query.severity;
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
            app.prisma.issue.findMany({
                where,
                include: {
                    site: { select: { id: true, name: true } },
                    worker: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                ...(0, pagination_js_1.paginate)(query),
            }),
            app.prisma.issue.count({ where }),
        ]);
        return (0, pagination_js_1.paginatedResponse)(data, total, query);
    });
    app.get('/:id', async (request, reply) => {
        const { id } = request.params;
        const issue = await app.prisma.issue.findFirst({
            where: { id, site: { companyId: request.user.companyId } },
            include: {
                site: { select: { id: true, name: true } },
                worker: { select: { id: true, name: true, phone: true } },
            },
        });
        if (!issue)
            return reply.code(404).send({ error: 'Issue not found' });
        if (issue.photoUrl)
            issue.photoUrl = await app.s3.getSignedUrl(issue.photoUrl);
        if (issue.resolutionPhotoUrl)
            issue.resolutionPhotoUrl = await app.s3.getSignedUrl(issue.resolutionPhotoUrl);
        return issue;
    });
    app.put('/:id/acknowledge', async (request, reply) => {
        const { id } = request.params;
        const result = await app.prisma.issue.updateMany({
            where: { id, site: { companyId: request.user.companyId }, status: 'OPEN' },
            data: { status: 'ACKNOWLEDGED' },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Issue not found or already acknowledged' });
        return { message: 'Issue acknowledged' };
    });
    app.put('/:id/respond', async (request, reply) => {
        const { id } = request.params;
        const { response } = zod_1.z.object({ response: zod_1.z.string().min(1) }).parse(request.body);
        const result = await app.prisma.issue.updateMany({
            where: { id, site: { companyId: request.user.companyId } },
            data: { response, respondedBy: request.user.id, respondedAt: new Date() },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Issue not found' });
        return { message: 'Response added' };
    });
    app.put('/:id/resolve', async (request, reply) => {
        const { id } = request.params;
        const body = zod_1.z.object({
            resolutionNote: zod_1.z.string().min(5, 'Resolution note must be at least 5 characters'),
            resolutionPhotoUrl: zod_1.z.string().optional(),
        }).parse(request.body);
        // Fetch resolver name for audit
        const resolver = await app.prisma.user.findUnique({
            where: { id: request.user.id },
            select: { fullName: true },
        });
        const result = await app.prisma.issue.updateMany({
            where: { id, site: { companyId: request.user.companyId } },
            data: {
                status: 'RESOLVED',
                resolvedAt: new Date(),
                resolutionPhotoUrl: body.resolutionPhotoUrl,
                // Store resolution note + resolver in response field (prefixed so it's distinguishable)
                response: `[RESOLVED by ${resolver?.fullName || 'Unknown'}] ${body.resolutionNote}`,
                respondedBy: request.user.id,
                respondedAt: new Date(),
            },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Issue not found' });
        return { message: 'Issue resolved' };
    });
}
//# sourceMappingURL=issues.js.map
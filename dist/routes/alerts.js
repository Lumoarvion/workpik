"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertRoutes = alertRoutes;
const zod_1 = require("zod");
const pagination_js_1 = require("../utils/pagination.js");
const listAlertsQuery = pagination_js_1.paginationSchema.extend({
    siteId: zod_1.z.string().uuid().optional(),
    alertType: zod_1.z.string().optional(),
    isRead: zod_1.z.coerce.boolean().optional(),
});
async function alertRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    app.get('/', async (request) => {
        const query = listAlertsQuery.parse(request.query);
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
        if (query.alertType)
            where.alertType = query.alertType;
        if (query.isRead !== undefined)
            where.isRead = query.isRead;
        const [data, total] = await Promise.all([
            app.prisma.alert.findMany({
                where,
                include: { site: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'desc' },
                ...(0, pagination_js_1.paginate)(query),
            }),
            app.prisma.alert.count({ where }),
        ]);
        return (0, pagination_js_1.paginatedResponse)(data, total, query);
    });
    // Static routes MUST come before parameterized routes
    app.put('/read-all', async (request) => {
        await app.prisma.alert.updateMany({
            where: { site: { companyId: request.user.companyId }, isRead: false },
            data: { isRead: true },
        });
        return { message: 'All alerts marked as read' };
    });
    app.get('/summary', async (request) => {
        const alerts = await app.prisma.alert.groupBy({
            by: ['alertType'],
            where: { site: { companyId: request.user.companyId }, isRead: false },
            _count: true,
        });
        const summary = {};
        for (const a of alerts)
            summary[a.alertType] = a._count;
        return summary;
    });
    // Parameterized routes
    app.put('/:id/read', async (request, reply) => {
        const { id } = request.params;
        const result = await app.prisma.alert.updateMany({
            where: { id, site: { companyId: request.user.companyId } },
            data: { isRead: true },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Alert not found' });
        return { message: 'Marked as read' };
    });
    // GPS override — mark a GPS mismatch submission as reviewed-and-OK
    app.put('/:id/gps-override', async (request, reply) => {
        const { id } = request.params;
        const { note } = zod_1.z.object({ note: zod_1.z.string().min(20, 'Note must be at least 20 characters') }).parse(request.body);
        const alert = await app.prisma.alert.findFirst({
            where: { id, site: { companyId: request.user.companyId }, alertType: 'gps_mismatch' },
            include: { site: { select: { id: true, name: true } } },
        });
        if (!alert)
            return reply.code(404).send({ error: 'Alert not found' });
        // Fetch reviewer name
        const reviewer = await app.prisma.user.findUnique({
            where: { id: request.user.id },
            select: { fullName: true },
        });
        const existingMeta = alert.metadata || {};
        const updatedMeta = {
            ...existingMeta,
            gpsOverride: {
                note,
                overriddenBy: request.user.id,
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
//# sourceMappingURL=alerts.js.map
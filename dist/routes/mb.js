"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mbRoutes = mbRoutes;
const zod_1 = require("zod");
const pagination_js_1 = require("../utils/pagination.js");
// ─── helpers ──────────────────────────────────────────────────────────────────
function computeQty(type, nos, l, b, h) {
    switch (type) {
        case 'AREA': return nos * l * b;
        case 'VOLUME': return nos * l * b * h;
        case 'LENGTH': return nos * l;
        case 'NOS': return nos;
        case 'LUMP_SUM': return 1;
        default: return 0;
    }
}
/** Recompute item.totalQty + item.amount, then MB.totalAmount */
async function recomputeTotals(app, itemId) {
    const rows = await app.prisma.mBRow.findMany({ where: { itemId } });
    const totalQty = rows.reduce((s, r) => s + Number(r.qty), 0);
    const item = await app.prisma.mBItem.findUnique({
        where: { id: itemId },
        select: { mbId: true, rate: true },
    });
    if (!item)
        return;
    const rate = Number(item.rate ?? 0);
    const amount = totalQty * rate;
    await app.prisma.mBItem.update({ where: { id: itemId }, data: { totalQty, amount } });
    // Recompute MB total
    const items = await app.prisma.mBItem.findMany({ where: { mbId: item.mbId } });
    const totalAmount = items.reduce((s, i) => s + Number(i.amount), 0);
    await app.prisma.measurementBook.update({ where: { id: item.mbId }, data: { totalAmount } });
}
// ─── validation schemas ───────────────────────────────────────────────────────
const createMBSchema = zod_1.z.object({
    billNumber: zod_1.z.string().min(1).max(50),
    title: zod_1.z.string().max(255).optional(),
    periodFrom: zod_1.z.string().optional(),
    periodTo: zod_1.z.string().optional(),
});
const updateMBSchema = createMBSchema.partial();
const createItemSchema = zod_1.z.object({
    description: zod_1.z.string().min(1).max(500),
    measurementType: zod_1.z.enum(['AREA', 'VOLUME', 'LENGTH', 'NOS', 'LUMP_SUM']),
    unit: zod_1.z.string().min(1).max(50),
    rate: zod_1.z.number().min(0).optional(),
    sortOrder: zod_1.z.number().int().default(0),
});
const updateItemSchema = createItemSchema.partial();
const rowSchema = zod_1.z.object({
    description: zod_1.z.string().max(255).optional(),
    nos: zod_1.z.number().min(0).default(1),
    length: zod_1.z.number().min(0).default(0),
    breadth: zod_1.z.number().min(0).default(0),
    height: zod_1.z.number().min(0).default(0),
    sortOrder: zod_1.z.number().int().default(0),
});
const listQuery = pagination_js_1.paginationSchema.extend({
    status: zod_1.z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
});
// ─── route export ─────────────────────────────────────────────────────────────
async function mbRoutes(app) {
    // All routes require authentication (user OR worker token)
    app.addHook('preHandler', async (request, reply) => {
        try {
            await app.authenticate(request, reply);
        }
        catch {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    });
    // ── List MBs for a site ────────────────────────────────────────────────────
    app.get('/sites/:siteId/mb', async (request, reply) => {
        const { siteId } = request.params;
        const query = listQuery.parse(request.query);
        // Verify site belongs to company
        const site = await app.prisma.site.findFirst({
            where: { id: siteId, companyId: request.user.companyId },
        });
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const where = { siteId };
        if (query.status)
            where.status = query.status;
        const [data, total] = await Promise.all([
            app.prisma.measurementBook.findMany({
                where,
                include: { _count: { select: { items: true } } },
                orderBy: { createdAt: 'desc' },
                ...(0, pagination_js_1.paginate)(query),
            }),
            app.prisma.measurementBook.count({ where }),
        ]);
        return (0, pagination_js_1.paginatedResponse)(data, total, query);
    });
    // ── Create MB ──────────────────────────────────────────────────────────────
    app.post('/sites/:siteId/mb', async (request, reply) => {
        const { siteId } = request.params;
        const body = createMBSchema.parse(request.body);
        const site = await app.prisma.site.findFirst({
            where: { id: siteId, companyId: request.user.companyId },
        });
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const mb = await app.prisma.measurementBook.create({
            data: {
                siteId,
                companyId: request.user.companyId,
                billNumber: body.billNumber,
                title: body.title,
                periodFrom: body.periodFrom ? new Date(body.periodFrom) : undefined,
                periodTo: body.periodTo ? new Date(body.periodTo) : undefined,
            },
        });
        return reply.code(201).send(mb);
    });
    // ── Get MB detail ──────────────────────────────────────────────────────────
    app.get('/sites/:siteId/mb/:mbId', async (request, reply) => {
        const { siteId, mbId } = request.params;
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
            include: {
                items: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        rows: { orderBy: { sortOrder: 'asc' } },
                    },
                },
            },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Measurement book not found' });
        return mb;
    });
    // ── Update MB header ───────────────────────────────────────────────────────
    app.put('/sites/:siteId/mb/:mbId', async (request, reply) => {
        const { siteId, mbId } = request.params;
        const body = updateMBSchema.parse(request.body);
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status === 'APPROVED')
            return reply.code(400).send({ error: 'Cannot edit an approved bill' });
        return app.prisma.measurementBook.update({
            where: { id: mbId },
            data: {
                billNumber: body.billNumber,
                title: body.title,
                periodFrom: body.periodFrom ? new Date(body.periodFrom) : undefined,
                periodTo: body.periodTo ? new Date(body.periodTo) : undefined,
            },
        });
    });
    // ── Delete MB (DRAFT only) ─────────────────────────────────────────────────
    app.delete('/sites/:siteId/mb/:mbId', async (request, reply) => {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { siteId, mbId } = request.params;
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status !== 'DRAFT')
            return reply.code(400).send({ error: 'Only DRAFT bills can be deleted' });
        await app.prisma.measurementBook.delete({ where: { id: mbId } });
        return { message: 'Deleted' };
    });
    // ── Submit for review ──────────────────────────────────────────────────────
    app.post('/sites/:siteId/mb/:mbId/submit', async (request, reply) => {
        const { siteId, mbId } = request.params;
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status !== 'DRAFT')
            return reply.code(400).send({ error: 'Only DRAFT bills can be submitted' });
        return app.prisma.measurementBook.update({
            where: { id: mbId },
            data: {
                status: 'SUBMITTED',
                submittedBy: request.user.id,
                submittedAt: new Date(),
            },
        });
    });
    // ── Approve ────────────────────────────────────────────────────────────────
    app.post('/sites/:siteId/mb/:mbId/approve', async (request, reply) => {
        if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { siteId, mbId } = request.params;
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status !== 'SUBMITTED')
            return reply.code(400).send({ error: 'Only SUBMITTED bills can be approved' });
        return app.prisma.measurementBook.update({
            where: { id: mbId },
            data: { status: 'APPROVED', reviewedBy: request.user.id, reviewedAt: new Date(), reviewNote: null },
        });
    });
    // ── Reject ─────────────────────────────────────────────────────────────────
    app.post('/sites/:siteId/mb/:mbId/reject', async (request, reply) => {
        if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(request.user.role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
        const { siteId, mbId } = request.params;
        const { note } = zod_1.z.object({ note: zod_1.z.string().optional() }).parse(request.body);
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status !== 'SUBMITTED')
            return reply.code(400).send({ error: 'Only SUBMITTED bills can be rejected' });
        return app.prisma.measurementBook.update({
            where: { id: mbId },
            data: {
                status: 'REJECTED',
                reviewedBy: request.user.id,
                reviewedAt: new Date(),
                reviewNote: note ?? null,
            },
        });
    });
    // ── Add item to MB ─────────────────────────────────────────────────────────
    app.post('/sites/:siteId/mb/:mbId/items', async (request, reply) => {
        const { siteId, mbId } = request.params;
        const body = createItemSchema.parse(request.body);
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status === 'APPROVED')
            return reply.code(400).send({ error: 'Cannot edit an approved bill' });
        const item = await app.prisma.mBItem.create({
            data: { mbId, ...body },
        });
        return reply.code(201).send(item);
    });
    // ── Update item ────────────────────────────────────────────────────────────
    app.put('/sites/:siteId/mb/:mbId/items/:itemId', async (request, reply) => {
        const { siteId, mbId, itemId } = request.params;
        const body = updateItemSchema.parse(request.body);
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status === 'APPROVED')
            return reply.code(400).send({ error: 'Cannot edit an approved bill' });
        const item = await app.prisma.mBItem.update({
            where: { id: itemId },
            data: body,
        });
        // If rate changed, recompute amounts
        if (body.rate !== undefined)
            await recomputeTotals(app, itemId);
        return item;
    });
    // ── Delete item ────────────────────────────────────────────────────────────
    app.delete('/sites/:siteId/mb/:mbId/items/:itemId', async (request, reply) => {
        const { siteId, mbId, itemId } = request.params;
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status === 'APPROVED')
            return reply.code(400).send({ error: 'Cannot edit an approved bill' });
        await app.prisma.mBItem.delete({ where: { id: itemId } });
        // Recompute MB total after item removal
        const items = await app.prisma.mBItem.findMany({ where: { mbId } });
        const totalAmount = items.reduce((s, i) => s + Number(i.amount), 0);
        await app.prisma.measurementBook.update({ where: { id: mbId }, data: { totalAmount } });
        return { message: 'Item deleted' };
    });
    // ── Add row ────────────────────────────────────────────────────────────────
    app.post('/sites/:siteId/mb/:mbId/items/:itemId/rows', async (request, reply) => {
        const { siteId, mbId, itemId } = request.params;
        const body = rowSchema.parse(request.body);
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status === 'APPROVED')
            return reply.code(400).send({ error: 'Cannot edit an approved bill' });
        const item = await app.prisma.mBItem.findUnique({ where: { id: itemId } });
        if (!item)
            return reply.code(404).send({ error: 'Item not found' });
        const qty = computeQty(item.measurementType, body.nos, body.length, body.breadth, body.height);
        const row = await app.prisma.mBRow.create({
            data: { itemId, ...body, qty },
        });
        await recomputeTotals(app, itemId);
        return reply.code(201).send(row);
    });
    // ── Update row ─────────────────────────────────────────────────────────────
    app.put('/sites/:siteId/mb/:mbId/items/:itemId/rows/:rowId', async (request, reply) => {
        const { siteId, mbId, itemId, rowId } = request.params;
        const body = rowSchema.partial().parse(request.body);
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status === 'APPROVED')
            return reply.code(400).send({ error: 'Cannot edit an approved bill' });
        const item = await app.prisma.mBItem.findUnique({ where: { id: itemId } });
        if (!item)
            return reply.code(404).send({ error: 'Item not found' });
        const existing = await app.prisma.mBRow.findUnique({ where: { id: rowId } });
        if (!existing)
            return reply.code(404).send({ error: 'Row not found' });
        // Merge with existing values for qty computation
        const merged = {
            nos: Number(body.nos ?? existing.nos),
            length: Number(body.length ?? existing.length),
            breadth: Number(body.breadth ?? existing.breadth),
            height: Number(body.height ?? existing.height),
        };
        const qty = computeQty(item.measurementType, merged.nos, merged.length, merged.breadth, merged.height);
        const row = await app.prisma.mBRow.update({
            where: { id: rowId },
            data: { ...body, qty },
        });
        await recomputeTotals(app, itemId);
        return row;
    });
    // ── Delete row ─────────────────────────────────────────────────────────────
    app.delete('/sites/:siteId/mb/:mbId/items/:itemId/rows/:rowId', async (request, reply) => {
        const { siteId, mbId, itemId, rowId } = request.params;
        const mb = await app.prisma.measurementBook.findFirst({
            where: { id: mbId, siteId, site: { companyId: request.user.companyId } },
        });
        if (!mb)
            return reply.code(404).send({ error: 'Not found' });
        if (mb.status === 'APPROVED')
            return reply.code(400).send({ error: 'Cannot edit an approved bill' });
        await app.prisma.mBRow.delete({ where: { id: rowId } });
        await recomputeTotals(app, itemId);
        return { message: 'Row deleted' };
    });
}
//# sourceMappingURL=mb.js.map
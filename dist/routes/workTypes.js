"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_BILLING_UNITS = exports.VALID_TRADES = void 0;
exports.workTypeRoutes = workTypeRoutes;
const zod_1 = require("zod");
const customFieldSchema = zod_1.z.object({
    id: zod_1.z.string(),
    label: zod_1.z.string().min(1).max(100),
    type: zod_1.z.enum(['text', 'number', 'textarea', 'checkbox', 'select', 'checklist']),
    required: zod_1.z.boolean().default(false),
    options: zod_1.z.array(zod_1.z.string()).optional(),
});
const photoStepSchema = zod_1.z.object({
    id: zod_1.z.string(),
    label: zod_1.z.string().min(1).max(100),
    description: zod_1.z.string().max(300).optional(),
    required: zod_1.z.boolean().default(true),
    sortOrder: zod_1.z.number().int().default(0),
});
exports.VALID_TRADES = [
    'Concrete',
    'Masonry',
    'Woodwork',
    'Electrical',
    'Plumbing',
    'Roofing',
    'Drainage',
    'Painting',
    'Steel / Structural',
    'General',
];
exports.VALID_BILLING_UNITS = [
    { value: 'm', label: 'm — metres' },
    { value: 'm²', label: 'm² — sq. metres' },
    { value: 'm³', label: 'm³ — cubic metres' },
    { value: 'no.', label: 'no. — numbers' },
    { value: 't', label: 't — tonnes' },
    { value: 'kg', label: 'kg — kilograms' },
    { value: 'ls', label: 'ls — lump sum' },
    { value: 'hr', label: 'hr — hours' },
];
const createWorkTypeSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    icon: zod_1.z.string().max(50).optional(),
    trade: zod_1.z.string().max(100).optional().nullable(),
    billingUnit: zod_1.z.string().max(20).optional().nullable(),
    sortOrder: zod_1.z.number().int().default(0),
    customFields: zod_1.z.array(customFieldSchema).optional(),
    photoSteps: zod_1.z.array(photoStepSchema).optional(),
});
const updateWorkTypeSchema = createWorkTypeSchema.partial();
async function workTypeRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // Return trades + billing units for UI dropdowns
    app.get('/meta', async () => ({
        trades: exports.VALID_TRADES,
        billingUnits: exports.VALID_BILLING_UNITS,
    }));
    app.get('/', async (request) => {
        return app.prisma.workType.findMany({
            where: { companyId: request.user.companyId },
            orderBy: [{ trade: 'asc' }, { sortOrder: 'asc' }],
        });
    });
    app.post('/', async (request, reply) => {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user.role)) {
            return reply.code(403).send({ error: 'Only admins can manage work types' });
        }
        const body = createWorkTypeSchema.parse(request.body);
        const wt = await app.prisma.workType.create({
            data: {
                companyId: request.user.companyId,
                name: body.name,
                icon: body.icon,
                trade: body.trade ?? null,
                billingUnit: body.billingUnit ?? null,
                sortOrder: body.sortOrder,
                customFields: body.customFields ?? undefined,
                photoSteps: body.photoSteps ?? undefined,
            },
        });
        return reply.code(201).send(wt);
    });
    app.put('/:id', async (request, reply) => {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user.role)) {
            return reply.code(403).send({ error: 'Only admins can manage work types' });
        }
        const { id } = request.params;
        const body = updateWorkTypeSchema.parse(request.body);
        const data = { ...body };
        if (body.customFields !== undefined) {
            data.customFields = body.customFields;
        }
        if (body.photoSteps !== undefined) {
            data.photoSteps = body.photoSteps;
        }
        const result = await app.prisma.workType.updateMany({
            where: { id, companyId: request.user.companyId },
            data,
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Work type not found' });
        return app.prisma.workType.findUnique({ where: { id } });
    });
    // Dedicated endpoint to update just custom fields
    app.put('/:id/custom-fields', async (request, reply) => {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user.role)) {
            return reply.code(403).send({ error: 'Only admins can manage work types' });
        }
        const { id } = request.params;
        const { customFields } = zod_1.z.object({
            customFields: zod_1.z.array(customFieldSchema),
        }).parse(request.body);
        const result = await app.prisma.workType.updateMany({
            where: { id, companyId: request.user.companyId },
            data: { customFields: customFields },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Work type not found' });
        return app.prisma.workType.findUnique({ where: { id } });
    });
    // Dedicated endpoint to update just photo steps
    app.put('/:id/photo-steps', async (request, reply) => {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user.role)) {
            return reply.code(403).send({ error: 'Only admins can manage work types' });
        }
        const { id } = request.params;
        const { photoSteps } = zod_1.z.object({
            photoSteps: zod_1.z.array(photoStepSchema),
        }).parse(request.body);
        const result = await app.prisma.workType.updateMany({
            where: { id, companyId: request.user.companyId },
            data: { photoSteps: photoSteps },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Work type not found' });
        return app.prisma.workType.findUnique({ where: { id } });
    });
    app.delete('/:id', async (request, reply) => {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user.role)) {
            return reply.code(403).send({ error: 'Only admins can manage work types' });
        }
        const { id } = request.params;
        try {
            await app.prisma.workType.deleteMany({ where: { id, companyId: request.user.companyId } });
            return { message: 'Work type deleted' };
        }
        catch {
            return reply.code(400).send({ error: 'Cannot delete work type in use' });
        }
    });
}
//# sourceMappingURL=workTypes.js.map
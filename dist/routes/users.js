"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = userRoutes;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const pagination_js_1 = require("../utils/pagination.js");
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(255),
    fullName: zod_1.z.string().min(2).max(255),
    password: zod_1.z.string().min(6).max(100),
    phone: zod_1.z.string().max(15).optional(),
    role: zod_1.z.enum(['MANAGER', 'CLIENT']),
});
const updateUserSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2).max(255).optional(),
    phone: zod_1.z.string().max(15).optional(),
    role: zod_1.z.enum(['MANAGER', 'CLIENT']).optional(),
    isActive: zod_1.z.boolean().optional(),
});
async function userRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // --- Static routes MUST come before parameterized routes ---
    app.get('/', async (request) => {
        const query = pagination_js_1.paginationSchema.parse(request.query);
        const where = { companyId: request.user.companyId };
        const [data, total] = await Promise.all([
            app.prisma.user.findMany({
                where,
                select: { id: true, email: true, fullName: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                ...(0, pagination_js_1.paginate)(query),
            }),
            app.prisma.user.count({ where }),
        ]);
        return (0, pagination_js_1.paginatedResponse)(data, total, query);
    });
    app.post('/', async (request, reply) => {
        if (request.user.role !== 'ADMIN' && request.user.role !== 'SUPER_ADMIN') {
            return reply.code(403).send({ error: 'Only admins can create users' });
        }
        const body = createUserSchema.parse(request.body);
        const existing = await app.prisma.user.findUnique({
            where: { companyId_email: { companyId: request.user.companyId, email: body.email } },
        });
        if (existing)
            return reply.code(409).send({ error: 'Email already exists' });
        const user = await app.prisma.user.create({
            data: {
                companyId: request.user.companyId,
                email: body.email,
                passwordHash: await bcryptjs_1.default.hash(body.password, 12),
                fullName: body.fullName,
                phone: body.phone,
                role: body.role,
            },
            select: { id: true, email: true, fullName: true, phone: true, role: true, createdAt: true },
        });
        return reply.code(201).send(user);
    });
    // Get own profile
    app.get('/me', async (request) => {
        const user = await app.prisma.user.findUnique({
            where: { id: request.user.id },
            select: { id: true, email: true, fullName: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
        });
        return user;
    });
    // Password change
    app.put('/me/password', async (request, reply) => {
        const body = zod_1.z.object({
            currentPassword: zod_1.z.string(),
            newPassword: zod_1.z.string().min(6).max(100),
        }).parse(request.body);
        const user = await app.prisma.user.findUnique({ where: { id: request.user.id } });
        if (!user || !(await bcryptjs_1.default.compare(body.currentPassword, user.passwordHash))) {
            return reply.code(400).send({ error: 'Current password is incorrect' });
        }
        await app.prisma.user.update({
            where: { id: request.user.id },
            data: { passwordHash: await bcryptjs_1.default.hash(body.newPassword, 12) },
        });
        return { message: 'Password updated' };
    });
    // --- Parameterized routes ---
    app.get('/:id', async (request, reply) => {
        const { id } = request.params;
        const user = await app.prisma.user.findFirst({
            where: { id, companyId: request.user.companyId },
            select: { id: true, email: true, fullName: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
        });
        if (!user)
            return reply.code(404).send({ error: 'User not found' });
        return user;
    });
    app.put('/:id', async (request, reply) => {
        const { id } = request.params;
        // Only admins can edit other users; users can edit their own profile (name, phone only)
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(request.user.role);
        const isSelf = request.user.id === id;
        if (!isAdmin && !isSelf) {
            return reply.code(403).send({ error: 'You can only update your own profile' });
        }
        const body = updateUserSchema.parse(request.body);
        // Non-admins cannot change role or isActive
        if (!isAdmin) {
            delete body.role;
            delete body.isActive;
        }
        const user = await app.prisma.user.updateMany({
            where: { id, companyId: request.user.companyId },
            data: body,
        });
        if (user.count === 0)
            return reply.code(404).send({ error: 'User not found' });
        return app.prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, fullName: true, phone: true, role: true, isActive: true },
        });
    });
    app.delete('/:id', async (request, reply) => {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user.role)) {
            return reply.code(403).send({ error: 'Only admins can deactivate users' });
        }
        const { id } = request.params;
        if (id === request.user.id) {
            return reply.code(400).send({ error: 'Cannot deactivate yourself' });
        }
        const result = await app.prisma.user.updateMany({
            where: { id, companyId: request.user.companyId },
            data: { isActive: false },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'User not found' });
        return { message: 'User deactivated' };
    });
}
//# sourceMappingURL=users.js.map
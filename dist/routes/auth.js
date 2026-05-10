"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const registerSchema = zod_1.z.object({
    companyName: zod_1.z.string().min(2).max(255),
    fullName: zod_1.z.string().min(2).max(255),
    email: zod_1.z.string().email().max(255),
    password: zod_1.z.string().min(6).max(100),
    phone: zod_1.z.string().max(15).optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
const refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string(),
});
const requestOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10).max(15),
});
const verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10).max(15),
    otp: zod_1.z.string().length(6),
});
async function authRoutes(app) {
    // Register company + admin
    app.post('/register', async (request, reply) => {
        const body = registerSchema.parse(request.body);
        const existing = await app.prisma.company.findFirst({
            where: { users: { some: { email: body.email } } },
        });
        if (existing) {
            return reply.code(409).send({ error: 'Email already registered' });
        }
        const passwordHash = await bcryptjs_1.default.hash(body.password, 12);
        const result = await app.prisma.$transaction(async (tx) => {
            const company = await tx.company.create({
                data: { name: body.companyName },
            });
            const user = await tx.user.create({
                data: {
                    companyId: company.id,
                    email: body.email,
                    passwordHash,
                    fullName: body.fullName,
                    phone: body.phone,
                    role: 'ADMIN',
                },
            });
            // Create default work types
            const defaultTypes = ['Cleaning', 'Security Patrol', 'Maintenance', 'Inspection', 'Gardening', 'Pest Control'];
            for (let i = 0; i < defaultTypes.length; i++) {
                await tx.workType.create({
                    data: {
                        companyId: company.id,
                        name: defaultTypes[i],
                        isDefault: true,
                        sortOrder: i,
                    },
                });
            }
            return { company, user };
        });
        const tokens = app.generateTokens({
            id: result.user.id,
            companyId: result.company.id,
            role: 'ADMIN',
            type: 'user',
        });
        return reply.code(201).send({
            company: { id: result.company.id, name: result.company.name, industry: result.company.industry, enabledModules: result.company.enabledModules, onboardingDone: result.company.onboardingDone },
            user: {
                id: result.user.id,
                email: result.user.email,
                fullName: result.user.fullName,
                role: result.user.role,
            },
            ...tokens,
        });
    });
    // Login
    app.post('/login', async (request, reply) => {
        const body = loginSchema.parse(request.body);
        const user = await app.prisma.user.findFirst({
            where: { email: body.email, isActive: true },
            include: { company: true },
        });
        if (!user || !(await bcryptjs_1.default.compare(body.password, user.passwordHash))) {
            return reply.code(401).send({ error: 'Invalid email or password' });
        }
        await app.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const tokens = app.generateTokens({
            id: user.id,
            companyId: user.companyId,
            role: user.role,
            type: 'user',
        });
        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                phone: user.phone,
            },
            company: {
                id: user.company.id,
                name: user.company.name,
                logo: user.company.logo,
                industry: user.company.industry,
                enabledModules: user.company.enabledModules,
                onboardingDone: user.company.onboardingDone,
            },
            ...tokens,
        };
    });
    // Refresh token
    app.post('/refresh', async (request, reply) => {
        const { refreshToken } = refreshSchema.parse(request.body);
        try {
            // Check if refresh token is blacklisted
            const blacklisted = await app.redis.get(`blacklist:${refreshToken}`);
            if (blacklisted) {
                return reply.code(401).send({ error: 'Token has been revoked' });
            }
            const payload = app.verifyRefreshToken(refreshToken);
            const tokens = app.generateTokens({
                id: payload.id,
                companyId: payload.companyId,
                role: payload.role,
                type: payload.type,
            });
            return tokens;
        }
        catch {
            return reply.code(401).send({ error: 'Invalid refresh token' });
        }
    });
    // Logout (invalidate both access and refresh tokens)
    app.post('/logout', async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            // Blacklist access token for 24h
            await app.redis.set(`blacklist:${token}`, '1', 'EX', 86400);
        }
        // Also blacklist refresh token if provided
        const { refreshToken } = request.body || {};
        if (refreshToken) {
            await app.redis.set(`blacklist:${refreshToken}`, '1', 'EX', 604800); // 7 days
        }
        return { message: 'Logged out' };
    });
    // Mobile OTP request
    app.post('/request-otp', async (request, reply) => {
        const { phone } = requestOtpSchema.parse(request.body);
        const worker = await app.prisma.worker.findFirst({
            where: { phone, status: 'ACTIVE' },
        });
        if (!worker) {
            return reply.code(404).send({ error: 'Worker not found or inactive' });
        }
        // TODO: Integrate SMS provider for production OTP delivery
        // For now, use fixed OTP for testing
        const otp = '123456';
        await app.redis.set(`otp:${phone}`, otp, 'EX', 300); // 5 min expiry
        return { message: 'OTP sent', otp };
    });
    // Mobile OTP verify
    app.post('/verify-otp', async (request, reply) => {
        const { phone, otp } = verifyOtpSchema.parse(request.body);
        const storedOtp = await app.redis.get(`otp:${phone}`);
        if (!storedOtp || storedOtp !== otp) {
            return reply.code(401).send({ error: 'Invalid or expired OTP' });
        }
        await app.redis.del(`otp:${phone}`);
        const worker = await app.prisma.worker.findFirst({
            where: { phone, status: 'ACTIVE' },
            include: {
                company: { select: { enabledModules: true, industry: true } },
                assignedSites: {
                    include: {
                        site: {
                            include: {
                                zones: { orderBy: { sortOrder: 'asc' } },
                                siteWorkTypes: { include: { workType: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!worker) {
            return reply.code(404).send({ error: 'Worker not found' });
        }
        const tokens = app.generateTokens({
            id: worker.id,
            companyId: worker.companyId,
            role: 'WORKER',
            type: 'worker',
        });
        return {
            worker: { id: worker.id, name: worker.name, phone: worker.phone, language: worker.language },
            company: { enabledModules: worker.company.enabledModules, industry: worker.company.industry },
            assignedSites: worker.assignedSites.map((sw) => ({
                id: sw.site.id,
                name: sw.site.name,
                latitude: sw.site.latitude,
                longitude: sw.site.longitude,
                gpsRadius: sw.site.gpsRadiusMetres,
                beforeAfterEnabled: sw.site.beforeAfterEnabled,
                minPhotosPerDay: sw.site.minPhotosPerDay,
                zones: sw.site.zones.map((z) => ({ id: z.id, name: z.name })),
                workTypes: sw.site.siteWorkTypes.map((swt) => ({
                    id: swt.workType.id,
                    name: swt.workType.name,
                    icon: swt.workType.icon,
                })),
            })),
            ...tokens,
        };
    });
}
//# sourceMappingURL=auth.js.map
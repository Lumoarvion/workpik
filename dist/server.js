"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const prisma_js_1 = require("./plugins/prisma.js");
const redis_js_1 = require("./plugins/redis.js");
const s3_js_1 = require("./plugins/s3.js");
const auth_js_1 = require("./plugins/auth.js");
const auth_js_2 = require("./routes/auth.js");
const company_js_1 = require("./routes/company.js");
const users_js_1 = require("./routes/users.js");
const workers_js_1 = require("./routes/workers.js");
const sites_js_1 = require("./routes/sites.js");
const workTypes_js_1 = require("./routes/workTypes.js");
const submissions_js_1 = require("./routes/submissions.js");
const issues_js_1 = require("./routes/issues.js");
const dashboard_js_1 = require("./routes/dashboard.js");
const alerts_js_1 = require("./routes/alerts.js");
const reports_js_1 = require("./routes/reports.js");
const mobile_js_1 = require("./routes/mobile.js");
const billing_js_1 = require("./routes/billing.js");
const mb_js_1 = require("./routes/mb.js");
const PORT = parseInt(process.env.PORT || '8080', 10);
async function buildApp() {
    const app = (0, fastify_1.default)({
        logger: {
            transport: process.env.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { colorize: true } }
                : undefined,
        },
    });
    await app.register(cors_1.default, {
        origin: process.env.CORS_ORIGIN?.split(',') || true,
        credentials: true,
    });
    // Allow empty JSON bodies for PUT/PATCH requests (Fastify 5 rejects them by default)
    app.removeContentTypeParser('application/json');
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
        try {
            const str = body.trim();
            done(null, str ? JSON.parse(str) : {});
        }
        catch (err) {
            done(err, undefined);
        }
    });
    await app.register(multipart_1.default, {
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
            files: 5,
        },
    });
    // Plugins
    await app.register(prisma_js_1.prismaPlugin);
    await app.register(redis_js_1.redisPlugin);
    await app.register(s3_js_1.s3Plugin);
    await app.register(auth_js_1.authPlugin);
    // Health check
    app.get('/health', async (request, reply) => {
        try {
            await app.prisma.$queryRaw `SELECT 1`;
            await app.redis.ping();
            return { status: 'ok', timestamp: new Date().toISOString() };
        }
        catch (err) {
            reply.code(503);
            return { status: 'error', message: 'Service unhealthy' };
        }
    });
    app.get('/api/v1/status', async () => {
        return { version: '1.0.0', name: 'Workpik API' };
    });
    // Routes
    await app.register(auth_js_2.authRoutes, { prefix: '/api/v1/auth' });
    await app.register(company_js_1.companyRoutes, { prefix: '/api/v1/company' });
    await app.register(users_js_1.userRoutes, { prefix: '/api/v1/users' });
    await app.register(workers_js_1.workerRoutes, { prefix: '/api/v1/workers' });
    await app.register(sites_js_1.siteRoutes, { prefix: '/api/v1/sites' });
    await app.register(workTypes_js_1.workTypeRoutes, { prefix: '/api/v1/work-types' });
    await app.register(submissions_js_1.submissionRoutes, { prefix: '/api/v1/submissions' });
    await app.register(issues_js_1.issueRoutes, { prefix: '/api/v1/issues' });
    await app.register(dashboard_js_1.dashboardRoutes, { prefix: '/api/v1/dashboard' });
    await app.register(alerts_js_1.alertRoutes, { prefix: '/api/v1/alerts' });
    await app.register(reports_js_1.reportRoutes, { prefix: '/api/v1/reports' });
    await app.register(mobile_js_1.mobileRoutes, { prefix: '/api/v1/mobile' });
    await app.register(billing_js_1.billingRoutes, { prefix: '/api/v1' });
    await app.register(mb_js_1.mbRoutes, { prefix: '/api/v1' });
    return app;
}
async function start() {
    const app = await buildApp();
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        app.log.info(`Server running on port ${PORT}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
if (require.main === module) {
    start();
}
//# sourceMappingURL=server.js.map
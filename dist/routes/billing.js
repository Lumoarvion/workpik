"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingRoutes = billingRoutes;
const zod_1 = require("zod");
const pagination_js_1 = require("../utils/pagination.js");
const dailyLogSchema = zod_1.z.object({
    logDate: zod_1.z.string(),
    weather: zod_1.z.enum(['CLEAR', 'CLOUDY', 'RAIN', 'STORM', 'WINDY', 'HOT', 'OTHER']).optional(),
    weatherNote: zod_1.z.string().optional(),
    crewCount: zod_1.z.number().int().min(0).optional(),
    workSummary: zod_1.z.string().optional(),
});
const equipmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    type: zod_1.z.enum(['OWNED', 'RENTED']).default('RENTED'),
    hoursUsed: zod_1.z.number().min(0).optional(),
    rentalCostPerHour: zod_1.z.number().min(0).optional(),
    totalCost: zod_1.z.number().min(0).optional(),
    note: zod_1.z.string().optional(),
});
const materialSchema = zod_1.z.object({
    item: zod_1.z.string().min(1).max(255),
    quantity: zod_1.z.number().min(0),
    unit: zod_1.z.string().min(1).max(50),
    unitCost: zod_1.z.number().min(0).optional(),
    totalCost: zod_1.z.number().min(0).optional(),
    vendor: zod_1.z.string().max(255).optional(),
    invoiceNumber: zod_1.z.string().max(100).optional(),
    trade: zod_1.z.string().max(100).optional().nullable(),
    note: zod_1.z.string().optional(),
});
const labourSchema = zod_1.z.object({
    workerId: zod_1.z.string().uuid().optional(),
    workerName: zod_1.z.string().min(1).max(255),
    role: zod_1.z.string().min(1).max(100),
    trade: zod_1.z.string().max(100).optional().nullable(),
    hoursWorked: zod_1.z.number().min(0).optional(),
    dailyWage: zod_1.z.number().min(0).optional(),
    overtime: zod_1.z.number().min(0).optional(),
    overtimeRate: zod_1.z.number().min(0).optional(),
    note: zod_1.z.string().optional(),
});
async function billingRoutes(app) {
    app.addHook('preHandler', app.authenticate);
    // Helper to verify site belongs to user's company
    async function verifySite(siteId, companyId) {
        return app.prisma.site.findFirst({
            where: { id: siteId, companyId },
        });
    }
    // ==================== TODAY SUMMARY (company-wide) ====================
    // GET /billing/today — aggregate daily log totals across all company sites for today
    app.get('/billing/today', async (request) => {
        const companyId = request.user.companyId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const logs = await app.prisma.dailySiteLog.findMany({
            where: { site: { companyId }, logDate: { gte: today, lt: tomorrow } },
            include: {
                site: { select: { id: true, name: true } },
                materialLogs: { select: { totalCost: true } },
                equipmentLogs: { select: { totalCost: true } },
                labourLogs: { select: { dailyWage: true } },
            },
        });
        const sites = logs.map((l) => {
            const matCost = l.materialLogs.reduce((s, m) => s + Number(m.totalCost || 0), 0);
            const eqCost = l.equipmentLogs.reduce((s, e) => s + Number(e.totalCost || 0), 0);
            const labCost = l.labourLogs.reduce((s, la) => s + Number(la.dailyWage || 0), 0);
            return {
                siteId: l.site.id,
                siteName: l.site.name,
                weather: l.weather,
                crewCount: l.crewCount,
                workSummary: l.workSummary,
                materialCost: matCost,
                equipmentCost: eqCost,
                labourCost: labCost,
                totalCost: matCost + eqCost + labCost,
                materialItems: l.materialLogs.length,
                labourEntries: l.labourLogs.length,
            };
        });
        return {
            date: today,
            logsCount: logs.length,
            totalMaterials: sites.reduce((s, x) => s + x.materialCost, 0),
            totalEquipment: sites.reduce((s, x) => s + x.equipmentCost, 0),
            totalLabour: sites.reduce((s, x) => s + x.labourCost, 0),
            totalToday: sites.reduce((s, x) => s + x.totalCost, 0),
            sites,
        };
    });
    // ==================== DAILY LOGS ====================
    // List daily logs for a site
    app.get('/sites/:siteId/billing', async (request, reply) => {
        const { siteId } = request.params;
        const query = pagination_js_1.paginationSchema.extend({
            dateFrom: zod_1.z.string().optional(),
            dateTo: zod_1.z.string().optional(),
        }).parse(request.query);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const where = { siteId };
        if (query.dateFrom || query.dateTo) {
            where.logDate = {};
            if (query.dateFrom)
                where.logDate.gte = new Date(query.dateFrom);
            if (query.dateTo)
                where.logDate.lte = new Date(query.dateTo);
        }
        const [data, total] = await Promise.all([
            app.prisma.dailySiteLog.findMany({
                where,
                include: {
                    createdByUser: { select: { fullName: true } },
                    _count: { select: { equipmentLogs: true, materialLogs: true, labourLogs: true } },
                    materialLogs: { select: { totalCost: true } },
                    equipmentLogs: { select: { totalCost: true } },
                    labourLogs: { select: { dailyWage: true, paid: true } },
                },
                orderBy: { logDate: 'desc' },
                ...(0, pagination_js_1.paginate)(query),
            }),
            app.prisma.dailySiteLog.count({ where }),
        ]);
        // Compute per-log cost totals, then strip the raw arrays to keep payload small
        const processedData = data.map(({ materialLogs, equipmentLogs, labourLogs, ...log }) => ({
            ...log,
            totalMaterial: materialLogs.reduce((s, m) => s + Number(m.totalCost || 0), 0),
            totalEquipment: equipmentLogs.reduce((s, e) => s + Number(e.totalCost || 0), 0),
            totalLabour: labourLogs.reduce((s, l) => s + Number(l.dailyWage || 0), 0),
            totalLabourUnpaid: labourLogs.filter((l) => !l.paid).reduce((s, l) => s + Number(l.dailyWage || 0), 0),
        }));
        return (0, pagination_js_1.paginatedResponse)(processedData, total, query);
    });
    // Create daily log
    app.post('/sites/:siteId/billing', async (request, reply) => {
        const { siteId } = request.params;
        const body = dailyLogSchema.parse(request.body);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        try {
            const log = await app.prisma.dailySiteLog.create({
                data: {
                    siteId,
                    logDate: new Date(body.logDate),
                    weather: body.weather,
                    weatherNote: body.weatherNote,
                    crewCount: body.crewCount,
                    workSummary: body.workSummary,
                    createdBy: request.user.id,
                },
                include: {
                    createdByUser: { select: { fullName: true } },
                    _count: { select: { equipmentLogs: true, materialLogs: true, labourLogs: true } },
                },
            });
            return reply.code(201).send(log);
        }
        catch (err) {
            if (err.code === 'P2002') {
                return reply.code(409).send({ error: 'A log already exists for this date' });
            }
            throw err;
        }
    });
    // Get single daily log with all entries
    app.get('/sites/:siteId/billing/:logId', async (request, reply) => {
        const { siteId, logId } = request.params;
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const log = await app.prisma.dailySiteLog.findFirst({
            where: { id: logId, siteId },
            include: {
                createdByUser: { select: { fullName: true } },
                equipmentLogs: { orderBy: { createdAt: 'asc' }, include: { billingPhotos: true } },
                materialLogs: { orderBy: { createdAt: 'asc' }, include: { billingPhotos: true } },
                labourLogs: { orderBy: { createdAt: 'asc' } },
                billingPhotos: true,
            },
        });
        if (!log)
            return reply.code(404).send({ error: 'Daily log not found' });
        // Sign photo URLs
        for (const eq of log.equipmentLogs) {
            for (const p of eq.billingPhotos) {
                if (p.photoUrl)
                    p.photoUrl = await app.s3.getSignedUrl(p.photoUrl);
                if (p.thumbnailUrl)
                    p.thumbnailUrl = await app.s3.getSignedUrl(p.thumbnailUrl);
            }
        }
        for (const mat of log.materialLogs) {
            for (const p of mat.billingPhotos) {
                if (p.photoUrl)
                    p.photoUrl = await app.s3.getSignedUrl(p.photoUrl);
                if (p.thumbnailUrl)
                    p.thumbnailUrl = await app.s3.getSignedUrl(p.thumbnailUrl);
            }
        }
        for (const p of log.billingPhotos) {
            if (p.photoUrl)
                p.photoUrl = await app.s3.getSignedUrl(p.photoUrl);
            if (p.thumbnailUrl)
                p.thumbnailUrl = await app.s3.getSignedUrl(p.thumbnailUrl);
        }
        return log;
    });
    // Update daily log
    app.put('/sites/:siteId/billing/:logId', async (request, reply) => {
        const { siteId, logId } = request.params;
        const body = dailyLogSchema.partial().parse(request.body);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const log = await app.prisma.dailySiteLog.updateMany({
            where: { id: logId, siteId },
            data: {
                weather: body.weather,
                weatherNote: body.weatherNote,
                crewCount: body.crewCount,
                workSummary: body.workSummary,
            },
        });
        if (log.count === 0)
            return reply.code(404).send({ error: 'Daily log not found' });
        return { message: 'Updated' };
    });
    // Delete daily log
    app.delete('/sites/:siteId/billing/:logId', async (request, reply) => {
        const { siteId, logId } = request.params;
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const result = await app.prisma.dailySiteLog.deleteMany({
            where: { id: logId, siteId },
        });
        if (result.count === 0)
            return reply.code(404).send({ error: 'Daily log not found' });
        return { message: 'Deleted' };
    });
    // ── Trade-wise submission summary for a specific daily log date ───────────────
    app.get('/sites/:siteId/billing/:logId/trade-summary', async (request, reply) => {
        const { siteId, logId } = request.params;
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        // Get the log's date
        const log = await app.prisma.dailySiteLog.findUnique({ where: { id: logId }, select: { logDate: true } });
        if (!log)
            return reply.code(404).send({ error: 'Log not found' });
        const dayStart = new Date(log.logDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const submissions = await app.prisma.submission.findMany({
            where: { siteId, createdAt: { gte: dayStart, lt: dayEnd } },
            select: {
                customData: true,
                workType: { select: { trade: true, billingUnit: true, name: true } },
            },
        });
        const tradeMap = new Map();
        for (const sub of submissions) {
            const trade = sub.workType.trade || 'General';
            if (!tradeMap.has(trade))
                tradeMap.set(trade, { totalQty: 0, count: 0, unit: sub.workType.billingUnit || '', workTypes: new Set() });
            const entry = tradeMap.get(trade);
            entry.count++;
            entry.workTypes.add(sub.workType.name);
            const cd = sub.customData;
            if (cd?.quantity && typeof cd.quantity === 'number')
                entry.totalQty += cd.quantity;
        }
        return Array.from(tradeMap.entries()).map(([trade, d]) => ({
            trade,
            totalQty: Math.round(d.totalQty * 100) / 100,
            unit: d.unit,
            submissionCount: d.count,
            workTypeNames: Array.from(d.workTypes),
        })).sort((a, b) => b.submissionCount - a.submissionCount);
    });
    // ==================== EQUIPMENT LOGS ====================
    app.post('/sites/:siteId/billing/:logId/equipment', async (request, reply) => {
        const { siteId, logId } = request.params;
        const body = equipmentSchema.parse(request.body);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const entry = await app.prisma.equipmentLog.create({
            data: { dailyLogId: logId, ...body },
        });
        return reply.code(201).send(entry);
    });
    app.put('/sites/:siteId/billing/:logId/equipment/:equipId', async (request, reply) => {
        const { equipId } = request.params;
        const body = equipmentSchema.partial().parse(request.body);
        const updated = await app.prisma.equipmentLog.update({
            where: { id: equipId },
            data: body,
        });
        return updated;
    });
    app.delete('/sites/:siteId/billing/:logId/equipment/:equipId', async (request, reply) => {
        const { equipId } = request.params;
        await app.prisma.equipmentLog.delete({ where: { id: equipId } });
        return { message: 'Deleted' };
    });
    // ==================== MATERIAL LOGS ====================
    app.post('/sites/:siteId/billing/:logId/materials', async (request, reply) => {
        const { siteId, logId } = request.params;
        const body = materialSchema.parse(request.body);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const entry = await app.prisma.materialLog.create({
            data: { dailyLogId: logId, ...body },
        });
        return reply.code(201).send(entry);
    });
    app.put('/sites/:siteId/billing/:logId/materials/:materialId', async (request, reply) => {
        const { materialId } = request.params;
        const body = materialSchema.partial().parse(request.body);
        const updated = await app.prisma.materialLog.update({
            where: { id: materialId },
            data: body,
        });
        return updated;
    });
    app.delete('/sites/:siteId/billing/:logId/materials/:materialId', async (request, reply) => {
        const { materialId } = request.params;
        await app.prisma.materialLog.delete({ where: { id: materialId } });
        return { message: 'Deleted' };
    });
    // ==================== LABOUR LOGS ====================
    app.post('/sites/:siteId/billing/:logId/labour', async (request, reply) => {
        const { siteId, logId } = request.params;
        const body = labourSchema.parse(request.body);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const entry = await app.prisma.labourLog.create({
            data: { dailyLogId: logId, ...body },
        });
        return reply.code(201).send(entry);
    });
    // Bulk add labour from assigned workers
    app.post('/sites/:siteId/billing/:logId/labour/bulk', async (request, reply) => {
        const { siteId, logId } = request.params;
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        // Get assigned workers
        const siteWorkers = await app.prisma.siteWorker.findMany({
            where: { siteId },
            include: { worker: { select: { id: true, name: true } } },
        });
        // Get existing labour entries for this log
        const existing = await app.prisma.labourLog.findMany({
            where: { dailyLogId: logId },
            select: { workerId: true },
        });
        const existingWorkerIds = new Set(existing.map((e) => e.workerId).filter(Boolean));
        // Create entries for workers not already logged
        const newEntries = siteWorkers
            .filter((sw) => !existingWorkerIds.has(sw.worker.id))
            .map((sw) => ({
            dailyLogId: logId,
            workerId: sw.worker.id,
            workerName: sw.worker.name,
            role: 'Worker',
        }));
        if (newEntries.length > 0) {
            await app.prisma.labourLog.createMany({ data: newEntries });
        }
        return { added: newEntries.length };
    });
    app.put('/sites/:siteId/billing/:logId/labour/:labourId', async (request, reply) => {
        const { labourId } = request.params;
        const body = labourSchema.partial().parse(request.body);
        const updated = await app.prisma.labourLog.update({
            where: { id: labourId },
            data: body,
        });
        return updated;
    });
    app.delete('/sites/:siteId/billing/:logId/labour/:labourId', async (request, reply) => {
        const { labourId } = request.params;
        await app.prisma.labourLog.delete({ where: { id: labourId } });
        return { message: 'Deleted' };
    });
    // ==================== MARK LABOUR PAID ====================
    // Toggle paid status on a single labour entry
    app.patch('/sites/:siteId/billing/:logId/labour/:labourId/paid', async (request, reply) => {
        const { siteId, labourId } = request.params;
        const { paid } = zod_1.z.object({ paid: zod_1.z.boolean() }).parse(request.body);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const updated = await app.prisma.labourLog.update({
            where: { id: labourId },
            data: {
                paid,
                paidAt: paid ? new Date() : null,
                paidBy: paid ? request.user.id : null,
            },
        });
        return updated;
    });
    // Mark ALL labour in a log as paid at once
    app.patch('/sites/:siteId/billing/:logId/labour/mark-all-paid', async (request, reply) => {
        const { siteId, logId } = request.params;
        const { paid } = zod_1.z.object({ paid: zod_1.z.boolean() }).parse(request.body);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        await app.prisma.labourLog.updateMany({
            where: { dailyLogId: logId },
            data: {
                paid,
                paidAt: paid ? new Date() : null,
                paidBy: paid ? request.user.id : null,
            },
        });
        return { message: 'Updated' };
    });
    // ==================== PAYROLL SUMMARY ====================
    // GET /sites/:siteId/billing-payroll — labour grouped by role for a date range
    app.get('/sites/:siteId/billing-payroll', async (request, reply) => {
        const { siteId } = request.params;
        const query = zod_1.z.object({
            dateFrom: zod_1.z.string().optional(),
            dateTo: zod_1.z.string().optional(),
        }).parse(request.query);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const logWhere = { siteId };
        if (query.dateFrom || query.dateTo) {
            logWhere.logDate = {};
            if (query.dateFrom)
                logWhere.logDate.gte = new Date(query.dateFrom);
            if (query.dateTo)
                logWhere.logDate.lte = new Date(query.dateTo);
        }
        const labourLogs = await app.prisma.labourLog.findMany({
            where: { dailyLog: logWhere },
            include: { dailyLog: { select: { logDate: true } } },
            orderBy: { dailyLog: { logDate: 'desc' } },
        });
        // Group by role
        const roleMap = new Map();
        for (const l of labourLogs) {
            let count = 1;
            try {
                if (l.note) {
                    const parsed = JSON.parse(l.note);
                    if (parsed?.count && typeof parsed.count === 'number')
                        count = parsed.count;
                }
            }
            catch { /* legacy entries without note */ }
            const role = l.role || l.workerName || 'Worker';
            const amount = Number(l.dailyWage || 0);
            if (!roleMap.has(role)) {
                roleMap.set(role, { role, entries: 0, totalWorkers: 0, totalAmount: 0, paidAmount: 0, unpaidAmount: 0 });
            }
            const r = roleMap.get(role);
            r.entries++;
            r.totalWorkers += count;
            r.totalAmount += amount;
            if (l.paid)
                r.paidAmount += amount;
            else
                r.unpaidAmount += amount;
        }
        const totalAmount = labourLogs.reduce((s, l) => s + Number(l.dailyWage || 0), 0);
        const paidAmount = labourLogs.filter((l) => l.paid).reduce((s, l) => s + Number(l.dailyWage || 0), 0);
        return {
            byRole: Array.from(roleMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
            totalAmount,
            paidAmount,
            unpaidAmount: totalAmount - paidAmount,
            totalEntries: labourLogs.length,
        };
    });
    // ==================== EXPENSE SUMMARY ====================
    app.get('/sites/:siteId/billing-summary', async (request, reply) => {
        const { siteId } = request.params;
        const query = zod_1.z.object({
            dateFrom: zod_1.z.string().optional(),
            dateTo: zod_1.z.string().optional(),
        }).parse(request.query);
        const site = await app.prisma.site.findFirst({ where: { id: siteId, companyId: request.user.companyId } });
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const where = { siteId };
        if (query.dateFrom || query.dateTo) {
            where.logDate = {};
            if (query.dateFrom)
                where.logDate.gte = new Date(query.dateFrom);
            if (query.dateTo)
                where.logDate.lte = new Date(query.dateTo);
        }
        const logs = await app.prisma.dailySiteLog.findMany({
            where,
            include: {
                equipmentLogs: { select: { totalCost: true } },
                materialLogs: { select: { totalCost: true } },
                labourLogs: { select: { dailyWage: true, overtime: true, overtimeRate: true } },
            },
            orderBy: { logDate: 'asc' },
        });
        let totalEquipment = 0;
        let totalMaterial = 0;
        let totalLabour = 0;
        const daily = logs.map((log) => {
            const equipCost = log.equipmentLogs.reduce((sum, e) => sum + Number(e.totalCost || 0), 0);
            const matCost = log.materialLogs.reduce((sum, m) => sum + Number(m.totalCost || 0), 0);
            const labCost = log.labourLogs.reduce((sum, l) => {
                const wage = Number(l.dailyWage || 0);
                const ot = Number(l.overtime || 0) * Number(l.overtimeRate || 0);
                return sum + wage + ot;
            }, 0);
            totalEquipment += equipCost;
            totalMaterial += matCost;
            totalLabour += labCost;
            return {
                date: log.logDate,
                crewCount: log.crewCount,
                equipmentCost: equipCost,
                materialCost: matCost,
                labourCost: labCost,
                totalCost: equipCost + matCost + labCost,
            };
        });
        return {
            budget: site.budget ? Number(site.budget) : null,
            summary: {
                totalEquipment,
                totalMaterial,
                totalLabour,
                grandTotal: totalEquipment + totalMaterial + totalLabour,
                daysLogged: logs.length,
            },
            daily,
        };
    });
    // ==================== CSV EXPORT ====================
    app.get('/sites/:siteId/billing-export', async (request, reply) => {
        const { siteId } = request.params;
        const query = zod_1.z.object({
            dateFrom: zod_1.z.string().optional(),
            dateTo: zod_1.z.string().optional(),
        }).parse(request.query);
        const site = await verifySite(siteId, request.user.companyId);
        if (!site)
            return reply.code(404).send({ error: 'Site not found' });
        const where = { siteId };
        if (query.dateFrom || query.dateTo) {
            where.logDate = {};
            if (query.dateFrom)
                where.logDate.gte = new Date(query.dateFrom);
            if (query.dateTo)
                where.logDate.lte = new Date(query.dateTo);
        }
        const logs = await app.prisma.dailySiteLog.findMany({
            where,
            include: {
                equipmentLogs: true,
                materialLogs: true,
                labourLogs: true,
            },
            orderBy: { logDate: 'asc' },
        });
        // Build CSV rows
        const rows = [];
        // Materials sheet
        rows.push('--- MATERIALS ---');
        rows.push('Date,Item,Quantity,Unit,Unit Cost,Total Cost,Vendor,Invoice #');
        for (const log of logs) {
            const date = new Date(log.logDate).toLocaleDateString('en-IN');
            for (const m of log.materialLogs) {
                rows.push([date, esc(m.item), m.quantity, esc(m.unit), m.unitCost || '', m.totalCost || '', esc(m.vendor || ''), esc(m.invoiceNumber || '')].join(','));
            }
        }
        rows.push('');
        rows.push('--- EQUIPMENT ---');
        rows.push('Date,Equipment,Type,Hours Used,Cost/Hour,Total Cost');
        for (const log of logs) {
            const date = new Date(log.logDate).toLocaleDateString('en-IN');
            for (const e of log.equipmentLogs) {
                rows.push([date, esc(e.name), e.type, e.hoursUsed || '', e.rentalCostPerHour || '', e.totalCost || ''].join(','));
            }
        }
        rows.push('');
        rows.push('--- LABOUR ---');
        rows.push('Date,Role,Count,Wage Per Worker,Total Wage,Hours,Overtime Hrs,OT Rate');
        for (const log of logs) {
            const date = new Date(log.logDate).toLocaleDateString('en-IN');
            for (const l of log.labourLogs) {
                let count = 1, wagePerWorker = Number(l.dailyWage || 0);
                try {
                    const n = l.note && JSON.parse(l.note);
                    if (n?.count) {
                        count = n.count;
                        wagePerWorker = n.wagePerWorker ?? wagePerWorker;
                    }
                }
                catch { }
                rows.push([date, esc(l.role || l.workerName), count, wagePerWorker, l.dailyWage || '', l.hoursWorked || '', l.overtime || '', l.overtimeRate || ''].join(','));
            }
        }
        rows.push('');
        rows.push('--- DAILY SUMMARY ---');
        rows.push('Date,Weather,Crew Count,Work Summary,Material Cost,Equipment Cost,Labour Cost,Total');
        for (const log of logs) {
            const date = new Date(log.logDate).toLocaleDateString('en-IN');
            const matCost = log.materialLogs.reduce((s, m) => s + Number(m.totalCost || 0), 0);
            const eqCost = log.equipmentLogs.reduce((s, e) => s + Number(e.totalCost || 0), 0);
            const labCost = log.labourLogs.reduce((s, l) => s + Number(l.dailyWage || 0), 0);
            rows.push([date, log.weather || '', log.crewCount || '', esc(log.workSummary || ''), matCost, eqCost, labCost, matCost + eqCost + labCost].join(','));
        }
        const csv = rows.join('\n');
        const filename = `billing-${site.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        return csv;
    });
}
function esc(str) {
    if (!str)
        return '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
//# sourceMappingURL=billing.js.map
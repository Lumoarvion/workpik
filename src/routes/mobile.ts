import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { haversineDistance } from '../utils/geo.js';

const dailyLogSchema = z.object({
  logDate: z.string().optional(), // defaults to today
  weather: z.enum(['CLEAR', 'CLOUDY', 'RAIN', 'STORM', 'WINDY', 'HOT', 'OTHER']).optional(),
  weatherNote: z.string().optional(),
  crewCount: z.coerce.number().int().min(0).optional(),
  workSummary: z.string().optional(),
});

const materialEntrySchema = z.object({
  item: z.string().min(1).max(255),
  quantity: z.coerce.number().min(0),
  unit: z.string().min(1).max(50),
  unitCost: z.coerce.number().min(0).optional(),
  totalCost: z.coerce.number().min(0).optional(),
  vendor: z.string().max(255).optional(),
  invoiceNumber: z.string().max(100).optional(),
  trade: z.string().max(100).optional().nullable(),
  note: z.string().optional(),
});

const equipmentEntrySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['OWNED', 'RENTED']).default('RENTED'),
  hoursUsed: z.coerce.number().min(0).optional(),
  rentalCostPerHour: z.coerce.number().min(0).optional(),
  totalCost: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
});

const labourEntrySchema = z.object({
  workerName: z.string().min(1).max(255),
  role: z.string().min(1).max(100).default('Worker'),
  hoursWorked: z.coerce.number().min(0).optional(),
  dailyWage: z.coerce.number().min(0).optional(),
  overtime: z.coerce.number().min(0).optional(),
  overtimeRate: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
});

export async function mobileRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Sync endpoint
  app.get('/sync', async (request) => {
    const worker = await app.prisma.worker.findUnique({
      where: { id: request.user!.id },
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

    if (!worker) return { worker: null, assignedSites: [], company: null, pendingNotifications: [] };

    return {
      worker: { id: worker.id, name: worker.name },
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
          trade: swt.workType.trade,
          billingUnit: swt.workType.billingUnit,
          customFields: swt.workType.customFields || [],
          photoSteps: swt.workType.photoSteps || [],
        })),
      })),
      pendingNotifications: [],
    };
  });

  // Submit from mobile (multipart)
  app.post('/submissions', async (request, reply) => {
    const parts = request.parts();
    const fields: Record<string, string> = {};
    const files: { buffer: Buffer; filename: string; mimetype: string }[] = [];

    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        files.push({ buffer, filename: part.filename || 'photo.jpg', mimetype: part.mimetype });
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    const schema = z.object({
      siteId: z.string().uuid(),
      workTypeId: z.string().uuid(),
      zoneId: z.string().uuid().optional(),
      note: z.string().optional(),
      latitude: z.coerce.number(),
      longitude: z.coerce.number(),
      gpsAccuracy: z.coerce.number().optional(),
      deviceTimestamp: z.string(),
      deviceId: z.string().optional(),
      isBeforePhoto: z.coerce.boolean().default(false),
      linkedSubmissionId: z.string().uuid().optional(),
      customData: z.string().optional(),
      photoStepMeta: z.string().optional(),
    });

    const data = schema.parse(fields);

    // Parse customData JSON string
    let parsedCustomData: Record<string, unknown> | undefined;
    if (data.customData) {
      try {
        parsedCustomData = JSON.parse(data.customData);
      } catch {
        return reply.code(400).send({ error: 'Invalid customData JSON' });
      }
    }

    // Parse photoStepMeta JSON string
    let parsedStepMeta: Array<{ photoIndex: number; stepId: string; latitude: number; longitude: number; capturedAt: string }> | undefined;
    if (data.photoStepMeta) {
      try {
        parsedStepMeta = JSON.parse(data.photoStepMeta);
      } catch {
        return reply.code(400).send({ error: 'Invalid photoStepMeta JSON' });
      }
    }

    // Get site for GPS validation
    const site = await app.prisma.site.findUnique({ where: { id: data.siteId } });
    if (!site) return reply.code(404).send({ error: 'Site not found' });

    // Verify worker is assigned to this site
    const assignment = await app.prisma.siteWorker.findUnique({
      where: { siteId_workerId: { siteId: data.siteId, workerId: request.user!.id } },
    });
    if (!assignment) return reply.code(403).send({ error: 'You are not assigned to this site' });

    // Validate zone belongs to site
    if (data.zoneId) {
      const zone = await app.prisma.zone.findFirst({ where: { id: data.zoneId, siteId: data.siteId } });
      if (!zone) return reply.code(400).send({ error: 'Zone does not belong to this site' });
    }

    // Validate work type is enabled for site
    const siteWorkType = await app.prisma.siteWorkType.findUnique({
      where: { siteId_workTypeId: { siteId: data.siteId, workTypeId: data.workTypeId } },
    });
    if (!siteWorkType) return reply.code(400).send({ error: 'Work type is not enabled for this site' });

    let distanceFromSite: number | null = null;
    let isWithinRadius = true;
    if (site.latitude && site.longitude) {
      distanceFromSite = haversineDistance(data.latitude, data.longitude, site.latitude, site.longitude);
      isWithinRadius = distanceFromSite <= site.gpsRadiusMetres;
    }

    // Validate required photo steps
    const workType = await app.prisma.workType.findUnique({ where: { id: data.workTypeId } });
    const photoStepsDef = (workType?.photoSteps as any[]) || [];
    if (photoStepsDef.length > 0 && parsedStepMeta) {
      const submittedStepIds = new Set(parsedStepMeta.map((m) => m.stepId));
      const missingRequired = photoStepsDef.filter((s) => s.required && !submittedStepIds.has(s.id));
      if (missingRequired.length > 0) {
        return reply.code(400).send({
          error: `Missing required photo steps: ${missingRequired.map((s) => s.label).join(', ')}`,
        });
      }
    }

    // Upload photos to S3
    const photoRecords: { photoUrl: string; sortOrder: number; photoStepId?: string; latitude?: number; longitude?: number; capturedAt?: Date }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = `submissions/${data.siteId}/${Date.now()}-${i}-${file.filename}`;
      await app.s3.upload(key, file.buffer, file.mimetype);
      const stepMeta = parsedStepMeta?.find((m) => m.photoIndex === i);
      photoRecords.push({
        photoUrl: key,
        sortOrder: i,
        ...(stepMeta && {
          photoStepId: stepMeta.stepId,
          latitude: stepMeta.latitude,
          longitude: stepMeta.longitude,
          capturedAt: new Date(stepMeta.capturedAt),
        }),
      });
    }

    const submission = await app.prisma.submission.create({
      data: {
        siteId: data.siteId,
        workerId: request.user!.id,
        workTypeId: data.workTypeId,
        zoneId: data.zoneId,
        note: data.note,
        latitude: data.latitude,
        longitude: data.longitude,
        gpsAccuracyM: data.gpsAccuracy,
        isWithinRadius,
        distanceFromSite,
        deviceId: data.deviceId,
        deviceTimestamp: new Date(data.deviceTimestamp),
        isBeforePhoto: data.isBeforePhoto,
        linkedSubmissionId: data.linkedSubmissionId,
        customData: parsedCustomData as any ?? undefined,
        photos: {
          create: photoRecords,
        },
      },
      include: { photos: true },
    });

    // Update worker last active
    await app.prisma.worker.update({
      where: { id: request.user!.id },
      data: { lastActiveAt: new Date() },
    });

    // Create alert if GPS mismatch
    if (!isWithinRadius) {
      await app.prisma.alert.create({
        data: {
          siteId: data.siteId,
          alertType: 'gps_mismatch',
          title: `GPS mismatch: photo taken ${Math.round(distanceFromSite || 0)}m from site`,
          description: `Worker submitted from outside the GPS radius`,
          metadata: { workerId: request.user!.id, distance: distanceFromSite, submissionId: submission.id },
        },
      });
    }

    return reply.code(201).send({ submission });
  });

  // Batch upload
  app.post('/submissions/batch', async (request, reply) => {
    const schema = z.object({
      submissions: z.array(z.object({
        siteId: z.string().uuid(),
        workTypeId: z.string().uuid(),
        zoneId: z.string().uuid().optional(),
        note: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
        gpsAccuracy: z.number().optional(),
        deviceTimestamp: z.string(),
        deviceId: z.string().optional(),
        isBeforePhoto: z.boolean().default(false),
        photos: z.array(z.object({
          base64: z.string(),
          filename: z.string(),
          mimetype: z.string().default('image/jpeg'),
        })),
      })),
    });

    const { submissions } = schema.parse(request.body);
    let created = 0;
    const errors: string[] = [];

    for (const sub of submissions) {
      try {
        const site = await app.prisma.site.findUnique({ where: { id: sub.siteId } });
        if (!site) { errors.push(`Site ${sub.siteId} not found`); continue; }

        // Verify worker is assigned to this site
        const assignment = await app.prisma.siteWorker.findUnique({
          where: { siteId_workerId: { siteId: sub.siteId, workerId: request.user!.id } },
        });
        if (!assignment) { errors.push(`Not assigned to site ${sub.siteId}`); continue; }

        // Validate zone belongs to site
        if (sub.zoneId) {
          const zone = await app.prisma.zone.findFirst({ where: { id: sub.zoneId, siteId: sub.siteId } });
          if (!zone) { errors.push(`Zone does not belong to site`); continue; }
        }

        // Validate work type is enabled for site
        const siteWorkType = await app.prisma.siteWorkType.findUnique({
          where: { siteId_workTypeId: { siteId: sub.siteId, workTypeId: sub.workTypeId } },
        });
        if (!siteWorkType) { errors.push(`Work type not enabled for site`); continue; }

        let distanceFromSite: number | null = null;
        let isWithinRadius = true;
        if (site.latitude && site.longitude) {
          distanceFromSite = haversineDistance(sub.latitude, sub.longitude, site.latitude, site.longitude);
          isWithinRadius = distanceFromSite <= site.gpsRadiusMetres;
        }

        // Check for duplicates
        const existing = await app.prisma.submission.findFirst({
          where: {
            deviceId: sub.deviceId,
            deviceTimestamp: new Date(sub.deviceTimestamp),
            siteId: sub.siteId,
          },
        });
        if (existing) { errors.push(`Duplicate submission skipped`); continue; }

        const photoRecords: { photoUrl: string; sortOrder: number }[] = [];
        for (let i = 0; i < sub.photos.length; i++) {
          const photo = sub.photos[i];
          const buffer = Buffer.from(photo.base64, 'base64');
          const key = `submissions/${sub.siteId}/${Date.now()}-${i}-${photo.filename}`;
          await app.s3.upload(key, buffer, photo.mimetype);
          photoRecords.push({ photoUrl: key, sortOrder: i });
        }

        await app.prisma.submission.create({
          data: {
            siteId: sub.siteId,
            workerId: request.user!.id,
            workTypeId: sub.workTypeId,
            zoneId: sub.zoneId,
            note: sub.note,
            latitude: sub.latitude,
            longitude: sub.longitude,
            gpsAccuracyM: sub.gpsAccuracy,
            isWithinRadius,
            distanceFromSite,
            deviceId: sub.deviceId,
            deviceTimestamp: new Date(sub.deviceTimestamp),
            isBeforePhoto: sub.isBeforePhoto,
            photos: { create: photoRecords },
          },
        });
        created++;
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    return { created, failed: errors.length, errors };
  });

  // Report issue from mobile
  app.post('/issues', async (request, reply) => {
    const parts = request.parts();
    const fields: Record<string, string> = {};
    let photoBuffer: Buffer | null = null;
    let photoFilename = '';
    let photoMimetype = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        photoBuffer = await part.toBuffer();
        photoFilename = part.filename || 'issue.jpg';
        photoMimetype = part.mimetype;
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    const schema = z.object({
      siteId: z.string().uuid(),
      category: z.string().max(100),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
      description: z.string().optional(),
      latitude: z.coerce.number().optional(),
      longitude: z.coerce.number().optional(),
    });
    const data = schema.parse(fields);

    let photoUrl: string | undefined;
    if (photoBuffer) {
      const key = `issues/${data.siteId}/${Date.now()}-${photoFilename}`;
      await app.s3.upload(key, photoBuffer, photoMimetype);
      photoUrl = key;
    }

    const issue = await app.prisma.issue.create({
      data: {
        siteId: data.siteId,
        workerId: request.user!.id,
        category: data.category,
        severity: data.severity,
        description: data.description,
        photoUrl,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    // Create alert for urgent issues
    if (data.severity === 'URGENT') {
      await app.prisma.alert.create({
        data: {
          siteId: data.siteId,
          alertType: 'urgent_issue',
          title: `Urgent issue: ${data.category}`,
          description: data.description,
          metadata: { issueId: issue.id, workerId: request.user!.id },
        },
      });
    }

    return reply.code(201).send({ issue });
  });

  // ==================== DAILY SITE LOGS (Construction) ====================

  // Get or create today's daily log for a site
  app.post('/daily-log', async (request, reply) => {
    const body = dailyLogSchema.parse(request.body);
    const { siteId } = z.object({ siteId: z.string().uuid() }).parse(request.body);
    const logDate = body.logDate ? new Date(body.logDate) : new Date();
    // Normalize to date-only
    logDate.setHours(0, 0, 0, 0);

    // Verify worker is assigned to this site
    const assignment = await app.prisma.siteWorker.findUnique({
      where: { siteId_workerId: { siteId, workerId: request.user!.id } },
    });
    if (!assignment) return reply.code(403).send({ error: 'Not assigned to this site' });

    // Upsert: get existing or create new
    let log = await app.prisma.dailySiteLog.findUnique({
      where: { siteId_logDate: { siteId, logDate } },
      include: {
        equipmentLogs: { orderBy: { createdAt: 'asc' } },
        materialLogs: { orderBy: { createdAt: 'asc' }, include: { billingPhotos: true } },
        labourLogs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!log) {
      log = await app.prisma.dailySiteLog.create({
        data: {
          siteId,
          logDate,
          weather: body.weather as any,
          weatherNote: body.weatherNote,
          crewCount: body.crewCount,
          workSummary: body.workSummary,
          createdBy: request.user!.id,
        },
        include: {
          equipmentLogs: { orderBy: { createdAt: 'asc' } },
          materialLogs: { orderBy: { createdAt: 'asc' }, include: { billingPhotos: true } },
          labourLogs: { orderBy: { createdAt: 'asc' } },
        },
      });
    }

    return log;
  });

  // Update daily log header (weather, crew count, summary)
  app.put('/daily-log/:logId', async (request, reply) => {
    const { logId } = request.params as { logId: string };
    const body = dailyLogSchema.partial().parse(request.body);

    const log = await app.prisma.dailySiteLog.findUnique({ where: { id: logId } });
    if (!log) return reply.code(404).send({ error: 'Log not found' });

    const updated = await app.prisma.dailySiteLog.update({
      where: { id: logId },
      data: {
        weather: body.weather as any,
        weatherNote: body.weatherNote,
        crewCount: body.crewCount,
        workSummary: body.workSummary,
      },
    });
    return updated;
  });

  // Get daily log with all entries
  app.get('/daily-log/:logId', async (request, reply) => {
    const { logId } = request.params as { logId: string };

    const log = await app.prisma.dailySiteLog.findUnique({
      where: { id: logId },
      include: {
        equipmentLogs: { orderBy: { createdAt: 'asc' } },
        materialLogs: { orderBy: { createdAt: 'asc' } },
        labourLogs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!log) return reply.code(404).send({ error: 'Log not found' });
    return log;
  });

  // List daily logs for a site (recent first)
  app.get('/daily-logs/:siteId', async (request, reply) => {
    const { siteId } = request.params as { siteId: string };

    const assignment = await app.prisma.siteWorker.findUnique({
      where: { siteId_workerId: { siteId, workerId: request.user!.id } },
    });
    if (!assignment) return reply.code(403).send({ error: 'Not assigned to this site' });

    const logs = await app.prisma.dailySiteLog.findMany({
      where: { siteId },
      include: {
        _count: { select: { equipmentLogs: true, materialLogs: true, labourLogs: true } },
      },
      orderBy: { logDate: 'desc' },
      take: 30,
    });
    return logs;
  });

  // Add material entry
  app.post('/daily-log/:logId/material', async (request, reply) => {
    const { logId } = request.params as { logId: string };
    const body = materialEntrySchema.parse(request.body);

    const entry = await app.prisma.materialLog.create({
      data: { dailyLogId: logId, ...body },
    });
    return reply.code(201).send(entry);
  });

  // Delete material entry
  app.delete('/daily-log/material/:entryId', async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    await app.prisma.materialLog.delete({ where: { id: entryId } });
    return { message: 'Deleted' };
  });

  // Add equipment entry
  app.post('/daily-log/:logId/equipment', async (request, reply) => {
    const { logId } = request.params as { logId: string };
    const body = equipmentEntrySchema.parse(request.body);

    const entry = await app.prisma.equipmentLog.create({
      data: { dailyLogId: logId, ...body },
    });
    return reply.code(201).send(entry);
  });

  // Delete equipment entry
  app.delete('/daily-log/equipment/:entryId', async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    await app.prisma.equipmentLog.delete({ where: { id: entryId } });
    return { message: 'Deleted' };
  });

  // Add labour entry
  app.post('/daily-log/:logId/labour', async (request, reply) => {
    const { logId } = request.params as { logId: string };
    const body = labourEntrySchema.parse(request.body);

    const entry = await app.prisma.labourLog.create({
      data: { dailyLogId: logId, ...body },
    });
    return reply.code(201).send(entry);
  });

  // Delete labour entry
  app.delete('/daily-log/labour/:entryId', async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    await app.prisma.labourLog.delete({ where: { id: entryId } });
    return { message: 'Deleted' };
  });

  // Upload photo for a daily log entry (multipart)
  app.post('/daily-log/:logId/photo', async (request, reply) => {
    const { logId } = request.params as { logId: string };
    const parts = request.parts();
    const fields: Record<string, string> = {};
    let photoBuffer: Buffer | null = null;
    let photoFilename = '';
    let photoMimetype = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        photoBuffer = await part.toBuffer();
        photoFilename = part.filename || 'photo.jpg';
        photoMimetype = part.mimetype;
      } else {
        fields[part.fieldname] = part.value as string;
      }
    }

    if (!photoBuffer) return reply.code(400).send({ error: 'No photo provided' });

    const key = `billing/${logId}/${Date.now()}-${photoFilename}`;
    await app.s3.upload(key, photoBuffer, photoMimetype);

    const photo = await app.prisma.billingPhoto.create({
      data: {
        dailyLogId: logId,
        equipmentLogId: fields.equipmentLogId || undefined,
        materialLogId: fields.materialLogId || undefined,
        photoUrl: key,
        caption: fields.caption || undefined,
      },
    });

    return reply.code(201).send(photo);
  });

  // Get alerts/notifications for worker's assigned sites
  app.get('/notifications', async (request) => {
    // Find worker's assigned sites
    const assignments = await app.prisma.siteWorker.findMany({
      where: { workerId: request.user!.id },
      select: { siteId: true },
    });
    const siteIds = assignments.map((a) => a.siteId);

    if (siteIds.length === 0) {
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }

    const alerts = await app.prisma.alert.findMany({
      where: { siteId: { in: siteIds } },
      include: { site: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { data: alerts, pagination: { page: 1, limit: 50, total: alerts.length, totalPages: 1 } };
  });
}

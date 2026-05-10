import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { industryTemplates, ALL_MODULES } from '../data/sectorTemplates.js';

const updateCompanySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  address: z.string().optional(),
  phone: z.string().max(15).optional(),
  email: z.string().email().max(255).optional(),
  gstNumber: z.string().max(15).optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function companyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (request) => {
    const company = await app.prisma.company.findUnique({
      where: { id: request.user!.companyId },
    });
    return company;
  });

  app.put('/', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can update company info' });
    }
    const body = updateCompanySchema.parse(request.body);
    const data: Prisma.CompanyUpdateInput = {
      ...body,
      settings: body.settings as Prisma.InputJsonValue | undefined,
    };
    const company = await app.prisma.company.update({
      where: { id: request.user!.companyId },
      data,
    });
    return company;
  });

  // Get all industry templates
  app.get('/industry-templates', async () => {
    return industryTemplates;
  });

  // Get all available modules
  app.get('/modules', async () => {
    return ALL_MODULES;
  });

  // Keep backward compat
  app.get('/sector-templates', async () => {
    return industryTemplates;
  });

  // Set industry + auto-enable modules + create work types
  app.put('/industry', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can update industry' });
    }
    const { industry } = z.object({
      industry: z.enum(['CONSTRUCTION', 'FACILITY_MANAGEMENT', 'HOME_SERVICES', 'SOLAR_INSTALLATION', 'SECURITY_PATROL', 'LOGISTICS_DELIVERY', 'GENERAL']),
    }).parse(request.body);

    const template = industryTemplates.find((t) => t.id === industry);
    if (!template) return reply.code(400).send({ error: 'Invalid industry' });

    // Update company with industry and modules
    const company = await app.prisma.company.findUnique({
      where: { id: request.user!.companyId },
    });
    const currentSettings = (company?.settings as Record<string, unknown>) || {};

    const updated = await app.prisma.$transaction(async (tx) => {
      // Update company
      const comp = await tx.company.update({
        where: { id: request.user!.companyId },
        data: {
          industry: industry as any,
          enabledModules: template.enabledModules,
          onboardingDone: true,
          settings: { ...currentSettings, sector: industry } as Prisma.InputJsonValue,
        },
      });

      // Delete existing default work types and create industry-specific ones
      await tx.workType.deleteMany({
        where: { companyId: request.user!.companyId, isDefault: true },
      });

      for (let i = 0; i < template.workTypes.length; i++) {
        const wt = template.workTypes[i];
        const customFields = wt.suggestedFields.map((f, idx) => ({
          id: f.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          ...f,
          sortOrder: idx,
        }));
        await tx.workType.create({
          data: {
            companyId: request.user!.companyId,
            name: wt.name,
            icon: wt.icon,
            isDefault: true,
            sortOrder: i,
            customFields: customFields as any,
            photoSteps: wt.photoSteps ? (wt.photoSteps as any) : undefined,
          },
        });
      }

      return comp;
    });

    return updated;
  });

  // Keep backward compat
  app.put('/sector', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can update sector' });
    }
    const { sector } = z.object({ sector: z.string() }).parse(request.body);

    const company = await app.prisma.company.findUnique({
      where: { id: request.user!.companyId },
    });
    const currentSettings = (company?.settings as Record<string, unknown>) || {};
    const updatedSettings = { ...currentSettings, sector };

    const updated = await app.prisma.company.update({
      where: { id: request.user!.companyId },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
    });
    return updated;
  });

  // Toggle modules on/off
  app.put('/modules', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can update modules' });
    }
    const { enabledModules } = z.object({
      enabledModules: z.array(z.string()),
    }).parse(request.body);

    // Always include core modules
    const coreModules = ALL_MODULES.filter((m) => m.core).map((m) => m.id);
    const finalModules = [...new Set([...coreModules, ...enabledModules])];

    const updated = await app.prisma.company.update({
      where: { id: request.user!.companyId },
      data: { enabledModules: finalModules },
    });
    return updated;
  });

  app.post('/logo', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can upload company logo' });
    }
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });

    const buffer = await file.toBuffer();
    const key = `companies/${request.user!.companyId}/logo/${Date.now()}-${file.filename}`;
    await app.s3.upload(key, buffer, file.mimetype);
    const logoUrl = await app.s3.getSignedUrl(key);

    await app.prisma.company.update({
      where: { id: request.user!.companyId },
      data: { logo: key },
    });

    return { logo: logoUrl };
  });
}

import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

const customFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100),
  type: z.enum(['text', 'number', 'textarea', 'checkbox', 'select', 'checklist']),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

const photoStepSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  required: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const VALID_TRADES = [
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
] as const;

export const VALID_BILLING_UNITS = [
  { value: 'm',   label: 'm — metres' },
  { value: 'm²',  label: 'm² — sq. metres' },
  { value: 'm³',  label: 'm³ — cubic metres' },
  { value: 'no.', label: 'no. — numbers' },
  { value: 't',   label: 't — tonnes' },
  { value: 'kg',  label: 'kg — kilograms' },
  { value: 'ls',  label: 'ls — lump sum' },
  { value: 'hr',  label: 'hr — hours' },
];

const createWorkTypeSchema = z.object({
  name: z.string().min(2).max(100),
  icon: z.string().max(50).optional(),
  trade: z.string().max(100).optional().nullable(),
  billingUnit: z.string().max(20).optional().nullable(),
  sortOrder: z.number().int().default(0),
  customFields: z.array(customFieldSchema).optional(),
  photoSteps: z.array(photoStepSchema).optional(),
});

const updateWorkTypeSchema = createWorkTypeSchema.partial();

export async function workTypeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // Return trades + billing units for UI dropdowns
  app.get('/meta', async () => ({
    trades: VALID_TRADES,
    billingUnits: VALID_BILLING_UNITS,
  }));

  app.get('/', async (request) => {
    return app.prisma.workType.findMany({
      where: { companyId: request.user!.companyId },
      orderBy: [{ trade: 'asc' }, { sortOrder: 'asc' }],
    });
  });

  app.post('/', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage work types' });
    }
    const body = createWorkTypeSchema.parse(request.body);
    const wt = await app.prisma.workType.create({
      data: {
        companyId: request.user!.companyId,
        name: body.name,
        icon: body.icon,
        trade: body.trade ?? null,
        billingUnit: body.billingUnit ?? null,
        sortOrder: body.sortOrder,
        customFields: body.customFields as unknown as Prisma.InputJsonValue ?? undefined,
        photoSteps: body.photoSteps as unknown as Prisma.InputJsonValue ?? undefined,
      },
    });
    return reply.code(201).send(wt);
  });

  app.put('/:id', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage work types' });
    }
    const { id } = request.params as { id: string };
    const body = updateWorkTypeSchema.parse(request.body);
    const data: any = { ...body };
    if (body.customFields !== undefined) {
      data.customFields = body.customFields as unknown as Prisma.InputJsonValue;
    }
    if (body.photoSteps !== undefined) {
      data.photoSteps = body.photoSteps as unknown as Prisma.InputJsonValue;
    }
    const result = await app.prisma.workType.updateMany({
      where: { id, companyId: request.user!.companyId },
      data,
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Work type not found' });
    return app.prisma.workType.findUnique({ where: { id } });
  });

  // Dedicated endpoint to update just custom fields
  app.put('/:id/custom-fields', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage work types' });
    }
    const { id } = request.params as { id: string };
    const { customFields } = z.object({
      customFields: z.array(customFieldSchema),
    }).parse(request.body);

    const result = await app.prisma.workType.updateMany({
      where: { id, companyId: request.user!.companyId },
      data: { customFields: customFields as unknown as Prisma.InputJsonValue },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Work type not found' });
    return app.prisma.workType.findUnique({ where: { id } });
  });

  // Dedicated endpoint to update just photo steps
  app.put('/:id/photo-steps', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage work types' });
    }
    const { id } = request.params as { id: string };
    const { photoSteps } = z.object({
      photoSteps: z.array(photoStepSchema),
    }).parse(request.body);

    const result = await app.prisma.workType.updateMany({
      where: { id, companyId: request.user!.companyId },
      data: { photoSteps: photoSteps as unknown as Prisma.InputJsonValue },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'Work type not found' });
    return app.prisma.workType.findUnique({ where: { id } });
  });

  app.delete('/:id', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can manage work types' });
    }
    const { id } = request.params as { id: string };
    try {
      await app.prisma.workType.deleteMany({ where: { id, companyId: request.user!.companyId } });
      return { message: 'Work type deleted' };
    } catch {
      return reply.code(400).send({ error: 'Cannot delete work type in use' });
    }
  });
}

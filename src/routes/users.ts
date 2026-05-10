import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { paginationSchema, paginate, paginatedResponse } from '../utils/pagination.js';

const createUserSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(2).max(255),
  password: z.string().min(6).max(100),
  phone: z.string().max(15).optional(),
  role: z.enum(['MANAGER', 'CLIENT']),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  phone: z.string().max(15).optional(),
  role: z.enum(['MANAGER', 'CLIENT']).optional(),
  isActive: z.boolean().optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // --- Static routes MUST come before parameterized routes ---

  app.get('/', async (request) => {
    const query = paginationSchema.parse(request.query);
    const where = { companyId: request.user!.companyId };
    const [data, total] = await Promise.all([
      app.prisma.user.findMany({
        where,
        select: { id: true, email: true, fullName: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        ...paginate(query),
      }),
      app.prisma.user.count({ where }),
    ]);
    return paginatedResponse(data, total, query);
  });

  app.post('/', async (request, reply) => {
    if (request.user!.role !== 'ADMIN' && request.user!.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Only admins can create users' });
    }
    const body = createUserSchema.parse(request.body);
    const existing = await app.prisma.user.findUnique({
      where: { companyId_email: { companyId: request.user!.companyId, email: body.email } },
    });
    if (existing) return reply.code(409).send({ error: 'Email already exists' });

    const user = await app.prisma.user.create({
      data: {
        companyId: request.user!.companyId,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
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
      where: { id: request.user!.id },
      select: { id: true, email: true, fullName: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    return user;
  });

  // Password change
  app.put('/me/password', async (request, reply) => {
    const body = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(6).max(100),
    }).parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      return reply.code(400).send({ error: 'Current password is incorrect' });
    }
    await app.prisma.user.update({
      where: { id: request.user!.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, 12) },
    });
    return { message: 'Password updated' };
  });

  // --- Parameterized routes ---

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await app.prisma.user.findFirst({
      where: { id, companyId: request.user!.companyId },
      select: { id: true, email: true, fullName: true, phone: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return user;
  });

  app.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    // Only admins can edit other users; users can edit their own profile (name, phone only)
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role);
    const isSelf = request.user!.id === id;
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
      where: { id, companyId: request.user!.companyId },
      data: body,
    });
    if (user.count === 0) return reply.code(404).send({ error: 'User not found' });
    return app.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, phone: true, role: true, isActive: true },
    });
  });

  app.delete('/:id', async (request, reply) => {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(request.user!.role)) {
      return reply.code(403).send({ error: 'Only admins can deactivate users' });
    }
    const { id } = request.params as { id: string };
    if (id === request.user!.id) {
      return reply.code(400).send({ error: 'Cannot deactivate yourself' });
    }
    const result = await app.prisma.user.updateMany({
      where: { id, companyId: request.user!.companyId },
      data: { isActive: false },
    });
    if (result.count === 0) return reply.code(404).send({ error: 'User not found' });
    return { message: 'User deactivated' };
  });
}

import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient;
    }
}
export declare const prismaPlugin: (fastify: FastifyInstance) => Promise<void>;
//# sourceMappingURL=prisma.d.ts.map
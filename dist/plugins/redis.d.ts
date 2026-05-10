import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
declare module 'fastify' {
    interface FastifyInstance {
        redis: Redis;
    }
}
export declare const redisPlugin: (fastify: FastifyInstance) => Promise<void>;
//# sourceMappingURL=redis.d.ts.map
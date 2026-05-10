import type { FastifyInstance, FastifyReply } from 'fastify';
export interface JwtPayload {
    id: string;
    companyId: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CLIENT' | 'WORKER';
    type: 'user' | 'worker';
}
declare module 'fastify' {
    interface FastifyRequest {
        user?: JwtPayload;
    }
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        authenticateOptional: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        generateTokens: (payload: Omit<JwtPayload, 'iat' | 'exp'>) => {
            accessToken: string;
            refreshToken: string;
        };
        verifyRefreshToken: (token: string) => JwtPayload;
    }
}
export declare const authPlugin: (fastify: FastifyInstance) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map
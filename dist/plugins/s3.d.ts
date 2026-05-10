import { S3Client } from '@aws-sdk/client-s3';
import type { FastifyInstance } from 'fastify';
export interface S3Service {
    client: S3Client;
    bucket: string;
    upload(key: string, body: Buffer, contentType: string): Promise<string>;
    getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
declare module 'fastify' {
    interface FastifyInstance {
        s3: S3Service;
    }
}
export declare const s3Plugin: (fastify: FastifyInstance) => Promise<void>;
//# sourceMappingURL=s3.d.ts.map
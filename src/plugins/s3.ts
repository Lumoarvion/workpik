import fp from 'fastify-plugin';
import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

export const s3Plugin = fp(async (fastify: FastifyInstance) => {
  const publicBaseUrl = process.env.S3_PUBLIC_URL?.replace(/\/+$/, '');
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || 'workpik',
      secretAccessKey: process.env.S3_SECRET_KEY || 'workpik123',
    },
    forcePathStyle: true,
  });

  const bucket = process.env.S3_BUCKET || 'workpik';

  // Ensure bucket exists
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      fastify.log.info(`Created S3 bucket: ${bucket}`);
    } catch (err) {
      fastify.log.warn(`Could not create bucket: ${err}`);
    }
  }

  const s3Service: S3Service = {
    client,
    bucket,
    async upload(key: string, body: Buffer, contentType: string): Promise<string> {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));
      return key;
    },
    async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
      if (publicBaseUrl) return `${publicBaseUrl}/${key}`;
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn });
    },
  };

  fastify.decorate('s3', s3Service);
});

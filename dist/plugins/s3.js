"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3Plugin = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
exports.s3Plugin = (0, fastify_plugin_1.default)(async (fastify) => {
    const client = new client_s3_1.S3Client({
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
        await client.send(new client_s3_1.HeadBucketCommand({ Bucket: bucket }));
    }
    catch {
        try {
            await client.send(new client_s3_1.CreateBucketCommand({ Bucket: bucket }));
            fastify.log.info(`Created S3 bucket: ${bucket}`);
        }
        catch (err) {
            fastify.log.warn(`Could not create bucket: ${err}`);
        }
    }
    const s3Service = {
        client,
        bucket,
        async upload(key, body, contentType) {
            await client.send(new client_s3_1.PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            }));
            return key;
        },
        async getSignedUrl(key, expiresIn = 3600) {
            const command = new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: key });
            return (0, s3_request_presigner_1.getSignedUrl)(client, command, { expiresIn });
        },
    };
    fastify.decorate('s3', s3Service);
});
//# sourceMappingURL=s3.js.map
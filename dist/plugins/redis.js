"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisPlugin = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const ioredis_1 = __importDefault(require("ioredis"));
exports.redisPlugin = (0, fastify_plugin_1.default)(async (fastify) => {
    const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
    });
    await redis.connect();
    fastify.decorate('redis', redis);
    fastify.addHook('onClose', async () => {
        await redis.quit();
    });
});
//# sourceMappingURL=redis.js.map
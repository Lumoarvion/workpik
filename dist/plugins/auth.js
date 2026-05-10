"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authPlugin = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key';
exports.authPlugin = (0, fastify_plugin_1.default)(async (fastify) => {
    const authenticate = async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            reply.code(401).send({ error: 'Unauthorized' });
            return;
        }
        try {
            const token = authHeader.substring(7);
            // Check if token is blacklisted (logged out)
            const blacklisted = await fastify.redis.get(`blacklist:${token}`);
            if (blacklisted) {
                reply.code(401).send({ error: 'Token has been revoked' });
                return;
            }
            const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            // For worker tokens, check if admin has force-revoked all sessions
            if (payload.type === 'worker') {
                const revokedAt = await fastify.redis.get(`worker:revoked:${payload.id}`);
                if (revokedAt && payload.iat && payload.iat < parseInt(revokedAt, 10)) {
                    reply.code(401).send({ error: 'Session has been revoked. Please log in again.' });
                    return;
                }
            }
            request.user = payload;
        }
        catch {
            reply.code(401).send({ error: 'Invalid token' });
        }
    };
    const authenticateOptional = async (request, _reply) => {
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            try {
                request.user = jsonwebtoken_1.default.verify(authHeader.substring(7), JWT_SECRET);
            }
            catch {
                // Ignore invalid tokens for optional auth
            }
        }
    };
    const generateTokens = (payload) => {
        const accessToken = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '24h' });
        const refreshToken = jsonwebtoken_1.default.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
        return { accessToken, refreshToken };
    };
    const verifyRefreshToken = (token) => {
        return jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
    };
    fastify.decorate('authenticate', authenticate);
    fastify.decorate('authenticateOptional', authenticateOptional);
    fastify.decorate('generateTokens', generateTokens);
    fastify.decorate('verifyRefreshToken', verifyRefreshToken);
});
//# sourceMappingURL=auth.js.map
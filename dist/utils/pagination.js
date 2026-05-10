"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationSchema = void 0;
exports.paginate = paginate;
exports.paginatedResponse = paginatedResponse;
const zod_1 = require("zod");
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
function paginate(query) {
    return {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
    };
}
function paginatedResponse(data, total, query) {
    return {
        data,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
}
//# sourceMappingURL=pagination.js.map
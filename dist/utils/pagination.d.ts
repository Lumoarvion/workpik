import { z } from 'zod';
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
}, {
    limit?: number | undefined;
    page?: number | undefined;
}>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export declare function paginate(query: PaginationQuery): {
    skip: number;
    take: number;
};
export declare function paginatedResponse<T>(data: T[], total: number, query: PaginationQuery): {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};
//# sourceMappingURL=pagination.d.ts.map
import type { FastifyInstance } from 'fastify';
export declare const VALID_TRADES: readonly ["Concrete", "Masonry", "Woodwork", "Electrical", "Plumbing", "Roofing", "Drainage", "Painting", "Steel / Structural", "General"];
export declare const VALID_BILLING_UNITS: {
    value: string;
    label: string;
}[];
export declare function workTypeRoutes(app: FastifyInstance): Promise<void>;
//# sourceMappingURL=workTypes.d.ts.map
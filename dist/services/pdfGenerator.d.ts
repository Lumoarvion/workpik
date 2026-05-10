export interface ReportPdfData {
    company: {
        name: string;
        logo?: string | null;
    };
    site: {
        name: string;
        address?: string | null;
    };
    reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    periodStart: Date;
    periodEnd: Date;
    reportDate: Date;
    stats: {
        totalSubmissions: number;
        issueCount: number;
        activeWorkers: number;
        gpsComplianceRate: number;
    };
    workerBreakdown: {
        name: string;
        count: number;
    }[];
    workTypeBreakdown: {
        name: string;
        count: number;
        trade?: string | null;
    }[];
}
/**
 * Generates a PDF report and returns it as a Buffer.
 */
export declare function generateReportPdf(report: ReportPdfData): Promise<Buffer>;
//# sourceMappingURL=pdfGenerator.d.ts.map
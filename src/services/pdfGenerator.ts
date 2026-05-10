import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportPdfData {
  company: { name: string; logo?: string | null };
  site: { name: string; address?: string | null };
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
  workerBreakdown: { name: string; count: number }[];
  workTypeBreakdown: { name: string; count: number; trade?: string | null }[];
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const PRIMARY = '#4f46e5';    // indigo-600
const PRIMARY_LIGHT = '#e0e7ff'; // indigo-100
const TEXT_MAIN = '#111827';  // gray-900
const TEXT_MUTED = '#6b7280'; // gray-500
const BORDER = '#e5e7eb';     // gray-200
const SUCCESS = '#16a34a';
const WARNING = '#d97706';
const DANGER = '#dc2626';
const WHITE = '#ffffff';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPeriod(start: Date, end: Date, type: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const s = start.toLocaleDateString('en-IN', opts);
  if (type === 'DAILY') return s;
  const e = end.toLocaleDateString('en-IN', opts);
  return `${s} – ${e}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Main generator ──────────────────────────────────────────────────────────

/**
 * Generates a PDF report and returns it as a Buffer.
 */
export async function generateReportPdf(report: ReportPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `${report.reportType} Report – ${report.site.name}`,
        Author: report.company.name,
        Subject: 'Proof-of-Work Report',
        Creator: 'Prooftrail',
      },
    });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100; // usable width
    let y = 50;

    // ── Header band ───────────────────────────────────────────────────────────
    // Indigo header rectangle
    doc.rect(0, 0, doc.page.width, 110).fill(PRIMARY);

    // Company name
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(20)
      .text(report.company.name, 50, 28, { width: W * 0.65 });

    // "REPORT" label top-right
    doc.font('Helvetica').fontSize(9).fillColor('#c7d2fe') // indigo-200
      .text(`${report.reportType} REPORT`, 50, 54, { width: W, align: 'right' });

    // Period string
    doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE)
      .text(formatPeriod(report.periodStart, report.periodEnd, report.reportType), 50, 68, { width: W, align: 'right' });

    // Site line
    const siteLabel = report.site.address
      ? `${report.site.name}  ·  ${report.site.address}`
      : report.site.name;
    doc.font('Helvetica').fontSize(10).fillColor('#c7d2fe')
      .text(siteLabel, 50, 86, { width: W, align: 'right' });

    y = 130;

    // ── Summary stat cards (horizontal strip) ─────────────────────────────────
    const CARD_W = (W - 30) / 4;
    const statCards = [
      { label: 'Total Submissions', value: String(report.stats.totalSubmissions), color: PRIMARY },
      { label: 'Active Workers', value: String(report.stats.activeWorkers), color: '#0891b2' },  // cyan-600
      { label: 'Issues Reported', value: String(report.stats.issueCount), color: report.stats.issueCount > 0 ? DANGER : SUCCESS },
      { label: 'GPS Compliance', value: `${report.stats.gpsComplianceRate}%`, color: SUCCESS },
    ];

    statCards.forEach((card, i) => {
      const x = 50 + i * (CARD_W + 10);
      // Card background
      doc.roundedRect(x, y, CARD_W, 68, 6).fill('#f9fafb');
      // Top accent bar
      doc.rect(x, y, CARD_W, 4).fill(card.color);
      // Value
      doc.font('Helvetica-Bold').fontSize(22).fillColor(card.color)
        .text(card.value, x, y + 14, { width: CARD_W, align: 'center' });
      // Label
      doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED)
        .text(card.label.toUpperCase(), x, y + 42, { width: CARD_W, align: 'center' });
    });

    y += 90;

    // ── Section helper ────────────────────────────────────────────────────────
    const sectionTitle = (title: string) => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(PRIMARY_LIGHT)
        .rect(50, y, W, 22).fill(PRIMARY);
      doc.fillColor(WHITE).text(title.toUpperCase(), 58, y + 6, { width: W - 16, characterSpacing: 0.5 });
      y += 28;
    };

    // ── Table helper ──────────────────────────────────────────────────────────
    const tableRow = (
      cols: { text: string; width: number; align?: 'left' | 'right' | 'center'; bold?: boolean; color?: string }[],
      rowY: number,
      bg?: string
    ) => {
      if (bg) {
        doc.rect(50, rowY, W, 20).fill(bg);
      }
      let cx = 50;
      cols.forEach((col) => {
        doc
          .font(col.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9)
          .fillColor(col.color || TEXT_MAIN)
          .text(col.text, cx + 4, rowY + 6, { width: col.width - 8, align: col.align || 'left', lineBreak: false });
        cx += col.width;
      });
      // Row bottom border
      doc.moveTo(50, rowY + 20).lineTo(50 + W, rowY + 20).stroke(BORDER);
    };

    const checkPageBreak = (needed = 25) => {
      if (y + needed > doc.page.height - 70) {
        doc.addPage();
        y = 50;
      }
    };

    // ── Worker breakdown ──────────────────────────────────────────────────────
    if (report.workerBreakdown.length > 0) {
      checkPageBreak(60);
      sectionTitle('Worker Breakdown');

      // Table header
      const workerCols = [
        { text: '#', width: 30, align: 'center' as const, bold: true, color: WHITE },
        { text: 'Worker Name', width: W - 100, align: 'left' as const, bold: true, color: WHITE },
        { text: 'Submissions', width: 70, align: 'right' as const, bold: true, color: WHITE },
      ];
      doc.rect(50, y, W, 20).fill('#374151'); // gray-700
      tableRow(workerCols, y);
      y += 20;

      const sorted = [...report.workerBreakdown].sort((a, b) => b.count - a.count);
      sorted.forEach((w, i) => {
        checkPageBreak(22);
        const bg = i % 2 === 0 ? WHITE : '#f9fafb';
        tableRow([
          { text: String(i + 1), width: 30, align: 'center', color: TEXT_MUTED },
          { text: w.name, width: W - 100 },
          { text: String(w.count), width: 70, align: 'right', bold: true, color: PRIMARY },
        ], y, bg);
        y += 20;
      });

      y += 16;
    }

    // ── Work type breakdown ───────────────────────────────────────────────────
    if (report.workTypeBreakdown.length > 0) {
      checkPageBreak(60);
      sectionTitle('Work Type Breakdown');

      doc.rect(50, y, W, 20).fill('#374151');
      tableRow([
        { text: '#', width: 30, align: 'center', bold: true, color: WHITE },
        { text: 'Work Type', width: W - 140, bold: true, color: WHITE },
        { text: 'Trade', width: 70, bold: true, color: WHITE },
        { text: 'Count', width: 40, align: 'right', bold: true, color: WHITE },
      ], y);
      y += 20;

      const sortedWt = [...report.workTypeBreakdown].sort((a, b) => b.count - a.count);
      sortedWt.forEach((wt, i) => {
        checkPageBreak(22);
        const bg = i % 2 === 0 ? WHITE : '#f9fafb';
        tableRow([
          { text: String(i + 1), width: 30, align: 'center', color: TEXT_MUTED },
          { text: wt.name, width: W - 140 },
          { text: wt.trade || '—', width: 70, color: TEXT_MUTED },
          { text: String(wt.count), width: 40, align: 'right', bold: true, color: PRIMARY },
        ], y, bg);
        y += 20;
      });

      y += 16;
    }

    // ── No data message ───────────────────────────────────────────────────────
    if (report.stats.totalSubmissions === 0) {
      checkPageBreak(60);
      doc.rect(50, y, W, 60).fill('#f9fafb').stroke(BORDER);
      doc.font('Helvetica').fontSize(11).fillColor(TEXT_MUTED)
        .text('No submissions were recorded during this period.', 50, y + 22, { width: W, align: 'center' });
      y += 76;
    }

    // ── Footer on every page ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const pageH = doc.page.height;
      // Footer bar
      doc.rect(0, pageH - 38, doc.page.width, 38).fill('#f3f4f6');
      doc.moveTo(0, pageH - 38).lineTo(doc.page.width, pageH - 38).stroke(BORDER);

      doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED)
        .text(`Generated by Prooftrail  ·  ${formatDate(new Date())}  ·  ${report.company.name}`, 50, pageH - 24, {
          width: W,
          align: 'left',
        });

      doc.font('Helvetica').fontSize(8).fillColor(TEXT_MUTED)
        .text(`Page ${i + 1} of ${range.count}`, 50, pageH - 24, { width: W, align: 'right' });
    }

    doc.end();
  });
}

/**
 * Non-destructive billing seed — adds 14 days of DailyLogs, MaterialLogs,
 * EquipmentLogs and LabourLogs to the first active site found.
 * Safe to run multiple times (skips days that already have a log).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ──────────── CONFIG ──────────────────────────────────────────────────────────

const DAYS = 14;          // How many days back to generate
const SITE_INDEX = 0;     // Use the first site in the DB (0-indexed)
const SITE_BUDGET = 850000; // ₹8,50,000 total budget

// ──────────── DATA TABLES ─────────────────────────────────────────────────────

const WEATHER = ['CLEAR', 'CLOUDY', 'RAIN', 'CLOUDY', 'CLEAR', 'HOT', 'CLEAR', 'WINDY', 'CLEAR', 'CLOUDY', 'CLEAR', 'RAIN', 'HOT', 'CLEAR'] as const;

const SUMMARIES = [
  'Foundation work on west wing; concrete pour completed for columns C5–C8.',
  'Brickwork on floors 3 & 4 progressing well. Plumbing rough-in started.',
  'Rain delay in the morning. Internal plastering on floor 2 resumed post-noon.',
  'Roofing tiles laid on Block A. Electrical conduit work on floors 1–3.',
  'Waterproofing treatment applied to terrace. Safety inspection by supervisor.',
  'Finishing work on lobby area. False ceiling installation started.',
  'Flooring tiles fixed in 12 units on floor 1. Painting primer coat applied.',
  'Scaffolding dismantled from south façade. Window frame installation.',
  'Door frames fixed in all floor 2 units. Sanitary fittings installed.',
  'Concrete curing check — all columns passed. External plastering continued.',
  'Electrical fixtures installed in 8 units. Lift shaft work progressing.',
  'Rain halted outdoor work. Indoor electrical wiring completed on floor 3.',
  'Final coat of paint on floor 1 units. Switchboard installation started.',
  'Punch list items on floors 1–2. Final plumbing check done.',
];

const MATERIALS = [
  { item: 'Cement (50 kg bags)', unit: 'bags', unitCost: 380, qtyRange: [20, 60] },
  { item: 'River Sand', unit: 'cft', unitCost: 28, qtyRange: [50, 150] },
  { item: 'M-Sand', unit: 'cft', unitCost: 22, qtyRange: [30, 100] },
  { item: 'TMT Steel Bars (Fe 500)', unit: 'kg', unitCost: 68, qtyRange: [100, 500] },
  { item: 'Bricks (wire cut)', unit: 'nos', unitCost: 9, qtyRange: [500, 2000] },
  { item: 'Plywood (18mm, 8×4 ft)', unit: 'sheets', unitCost: 1100, qtyRange: [5, 20] },
  { item: 'PVC Pipe (4")', unit: 'pcs', unitCost: 165, qtyRange: [10, 40] },
  { item: 'Ceramic Floor Tiles', unit: 'sqft', unitCost: 52, qtyRange: [200, 600] },
  { item: 'Exterior Wall Paint', unit: 'litres', unitCost: 280, qtyRange: [20, 80] },
  { item: 'Electrical Wire (2.5 sqmm)', unit: 'mtrs', unitCost: 38, qtyRange: [100, 400] },
  { item: 'Aggregate (20mm)', unit: 'cft', unitCost: 35, qtyRange: [80, 200] },
  { item: 'Waterproof Compound', unit: 'kg', unitCost: 95, qtyRange: [20, 60] },
  { item: 'Steel Door Frames', unit: 'nos', unitCost: 2800, qtyRange: [2, 8] },
  { item: 'POP Powder (50 kg)', unit: 'bags', unitCost: 340, qtyRange: [5, 20] },
  { item: 'Binding Wire', unit: 'kg', unitCost: 85, qtyRange: [10, 30] },
];

const EQUIPMENT = [
  { name: 'Concrete Mixer (one bag)', type: 'RENTED', ratePerHour: 180, hoursRange: [6, 10] },
  { name: 'Tower Crane', type: 'RENTED', ratePerHour: 2200, hoursRange: [6, 10] },
  { name: 'Bar Bending Machine', type: 'OWNED', ratePerHour: 0, hoursRange: [4, 8] },
  { name: 'JCB Excavator', type: 'RENTED', ratePerHour: 1400, hoursRange: [4, 8] },
  { name: 'Scaffolding (set)', type: 'RENTED', ratePerHour: 350, hoursRange: [8, 10] },
  { name: 'Diesel Generator (62.5 kVA)', type: 'OWNED', ratePerHour: 0, hoursRange: [8, 10] },
  { name: 'Vibrator (needle)', type: 'OWNED', ratePerHour: 0, hoursRange: [4, 8] },
  { name: 'Dumper Truck', type: 'RENTED', ratePerHour: 1100, hoursRange: [4, 6] },
];

const LABOUR_ROLES = [
  { role: 'Mason', wagePerWorker: 750, countRange: [3, 8] },
  { role: 'Helper / Mazdoor', wagePerWorker: 480, countRange: [5, 12] },
  { role: 'Carpenter', wagePerWorker: 700, countRange: [2, 5] },
  { role: 'Electrician', wagePerWorker: 850, countRange: [1, 3] },
  { role: 'Plumber', wagePerWorker: 800, countRange: [1, 3] },
  { role: 'Painter', wagePerWorker: 680, countRange: [2, 4] },
  { role: 'Supervisor', wagePerWorker: 1300, countRange: [1, 2] },
  { role: 'Steel Fixer', wagePerWorker: 720, countRange: [2, 6] },
];

const VENDORS = ['Ramesh Traders', 'Vijay Building Mart', 'Krishna Hardware', 'Shree Agencies', 'Modern Suppliers', null];

// ──────────── HELPERS ─────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateOffset(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

// ──────────── MAIN ────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting billing seed (non-destructive)...\n');

  // Find the first company
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) throw new Error('No company found — run the main seed first');

  // Get all active sites
  const sites = await prisma.site.findMany({
    where: { companyId: company.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  if (!sites.length) throw new Error('No active sites found');

  const site = sites[SITE_INDEX % sites.length];
  console.log(`📍 Target site: "${site.name}" (${site.id})`);

  // Set budget on the site
  await prisma.site.update({
    where: { id: site.id },
    data: { budget: SITE_BUDGET },
  });
  console.log(`💰 Budget set to ₹${SITE_BUDGET.toLocaleString('en-IN')}\n`);

  // Find admin user to use as createdBy
  const adminUser = await prisma.user.findFirst({
    where: { companyId: company.id, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
  });
  if (!adminUser) throw new Error('No admin user found');

  let created = 0;
  let skipped = 0;

  for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
    const logDate = dateOffset(daysAgo);
    const dayLabel = logDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // Skip if log already exists for this day
    const existing = await prisma.dailySiteLog.findUnique({
      where: { siteId_logDate: { siteId: site.id, logDate } },
    });
    if (existing) {
      console.log(`  ⏭  ${dayLabel} — log already exists, skipping`);
      skipped++;
      continue;
    }

    const weatherIdx = (DAYS - 1 - daysAgo) % WEATHER.length;
    const weather = WEATHER[weatherIdx];
    const crewCount = rand(12, 28);
    const summary = SUMMARIES[(DAYS - 1 - daysAgo) % SUMMARIES.length];

    const log = await prisma.dailySiteLog.create({
      data: {
        siteId: site.id,
        logDate,
        weather,
        crewCount,
        workSummary: summary,
        createdBy: adminUser.id,
      },
    });

    // ── Materials (2–4 per day) ──
    const matCount = rand(2, 4);
    const usedMats = new Set<number>();
    let dayMatTotal = 0;
    for (let m = 0; m < matCount; m++) {
      let idx: number;
      do { idx = rand(0, MATERIALS.length - 1); } while (usedMats.has(idx));
      usedMats.add(idx);
      const mat = MATERIALS[idx];
      const qty = randFloat(mat.qtyRange[0], mat.qtyRange[1]);
      const unitCost = randFloat(mat.unitCost * 0.9, mat.unitCost * 1.1);
      const totalCost = parseFloat((qty * unitCost).toFixed(2));
      dayMatTotal += totalCost;
      const vendor = pick(VENDORS) as string | null;
      await prisma.materialLog.create({
        data: {
          dailyLogId: log.id,
          item: mat.item,
          quantity: qty,
          unit: mat.unit,
          unitCost,
          totalCost,
          vendor: vendor ?? undefined,
          invoiceNumber: vendor ? `INV-${rand(1000, 9999)}` : undefined,
        },
      });
    }

    // ── Equipment (1–3 per day) ──
    const eqCount = rand(1, 3);
    const usedEqs = new Set<number>();
    let dayEqTotal = 0;
    for (let e = 0; e < eqCount; e++) {
      let idx: number;
      do { idx = rand(0, EQUIPMENT.length - 1); } while (usedEqs.has(idx));
      usedEqs.add(idx);
      const eq = EQUIPMENT[idx];
      const hours = randFloat(eq.hoursRange[0], eq.hoursRange[1]);
      const rate = eq.type === 'OWNED' ? 0 : randFloat(eq.ratePerHour * 0.9, eq.ratePerHour * 1.1);
      const totalCost = parseFloat((hours * rate).toFixed(2));
      dayEqTotal += totalCost;
      await prisma.equipmentLog.create({
        data: {
          dailyLogId: log.id,
          name: eq.name,
          type: eq.type as 'OWNED' | 'RENTED',
          hoursUsed: hours,
          rentalCostPerHour: rate > 0 ? rate : undefined,
          totalCost: totalCost > 0 ? totalCost : undefined,
        },
      });
    }

    // ── Labour (3–5 roles per day) ──
    const labourCount = rand(3, 5);
    const usedRoles = new Set<number>();
    let dayLabourTotal = 0;
    // How many entries will be paid (older days mostly paid, recent days less paid)
    const paidThreshold = daysAgo > 7 ? 1.0 : daysAgo > 3 ? 0.7 : 0.3;

    for (let l = 0; l < labourCount; l++) {
      let idx: number;
      do { idx = rand(0, LABOUR_ROLES.length - 1); } while (usedRoles.has(idx));
      usedRoles.add(idx);
      const role = LABOUR_ROLES[idx];
      const count = rand(role.countRange[0], role.countRange[1]);
      const wagePerWorker = rand(Math.floor(role.wagePerWorker * 0.9), Math.ceil(role.wagePerWorker * 1.1));
      const dailyWage = count * wagePerWorker;
      dayLabourTotal += dailyWage;
      const isPaid = Math.random() < paidThreshold;

      await prisma.labourLog.create({
        data: {
          dailyLogId: log.id,
          workerName: `${count}× ${role.role}`,
          role: role.role,
          hoursWorked: 8,
          dailyWage,
          note: JSON.stringify({ count, wagePerWorker }),
          paid: isPaid,
          paidAt: isPaid ? new Date(logDate.getTime() + 2 * 24 * 60 * 60 * 1000) : undefined,
          paidBy: isPaid ? adminUser.id : undefined,
        },
      });
    }

    const dayTotal = dayMatTotal + dayEqTotal + dayLabourTotal;
    console.log(
      `  ✅ ${dayLabel}  ${weather.padEnd(8)} crew=${crewCount.toString().padStart(2)}  ` +
      `mat=₹${Math.round(dayMatTotal).toLocaleString('en-IN').padStart(8)}  ` +
      `equip=₹${Math.round(dayEqTotal).toLocaleString('en-IN').padStart(8)}  ` +
      `labour=₹${Math.round(dayLabourTotal).toLocaleString('en-IN').padStart(8)}  ` +
      `total=₹${Math.round(dayTotal).toLocaleString('en-IN')}`
    );
    created++;
  }

  console.log(`\n✅ Done — created ${created} log(s), skipped ${skipped} existing log(s)`);
  console.log(`\nNow open app.workpik.in/billing → select "${site.name}" to see the data.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

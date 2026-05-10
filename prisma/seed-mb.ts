/**
 * Non-destructive MB seed — adds realistic Measurement Book data
 * to the first active site found. Safe to run multiple times.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting MB seed...\n');

  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!company) throw new Error('No company found');

  const sites = await prisma.site.findMany({
    where: { companyId: company.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  if (!sites.length) throw new Error('No active sites found');

  const site = sites[0];
  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
  });
  if (!admin) throw new Error('No admin user found');

  console.log(`📍 Site: "${site.name}"`);
  console.log(`👤 User: ${admin.fullName}\n`);

  // ── Bill 1: APPROVED — Tiling Work (like the screenshot) ─────────────────
  const mb1 = await prisma.measurementBook.create({
    data: {
      siteId: site.id,
      companyId: company.id,
      billNumber: 'MB-003',
      title: 'Tiling Work',
      periodFrom: new Date('2026-03-01'),
      periodTo: new Date('2026-03-25'),
      status: 'APPROVED',
      reviewedBy: admin.id,
      reviewedAt: new Date('2026-03-28'),
      totalAmount: 0,
    },
  });

  // Item 1: Tile work (AREA)
  const i1 = await prisma.mBItem.create({
    data: { mbId: mb1.id, description: 'Tile work (Terrace tile work)', measurementType: 'AREA', unit: 'Sq.Ft', rate: 70, sortOrder: 0 },
  });
  const i1rows = [
    { desc: 'Skirting',     nos: 1, l: 43,  b: 1   },
    { desc: 'Step',         nos: 1, l: 10,  b: 1   },
    { desc: 'Front Floor',  nos: 1, l: 37,  b: 10  },
    { desc: 'Skirting',     nos: 1, l: 17,  b: 1   },
    { desc: 'Floor',        nos: 1, l: 37,  b: 10  },
    { desc: 'Skirting',     nos: 1, l: 17,  b: 1   },
  ];
  for (let idx = 0; idx < i1rows.length; idx++) {
    const r = i1rows[idx];
    await prisma.mBRow.create({ data: { itemId: i1.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, qty: r.nos * r.l * r.b, sortOrder: idx } });
  }
  const i1qty = i1rows.reduce((s, r) => s + r.nos * r.l * r.b, 0);
  await prisma.mBItem.update({ where: { id: i1.id }, data: { totalQty: i1qty, amount: i1qty * 70 } });

  // Item 2: Epoxy Filling — LUMP_SUM
  const i2 = await prisma.mBItem.create({
    data: { mbId: mb1.id, description: 'Epoxy Filling work', measurementType: 'LUMP_SUM', unit: 'LS', rate: 21720, sortOrder: 1 },
  });
  await prisma.mBRow.create({ data: { itemId: i2.id, description: 'Epoxy filling all areas', nos: 1, qty: 1, sortOrder: 0 } });
  await prisma.mBItem.update({ where: { id: i2.id }, data: { totalQty: 1, amount: 21720 } });

  // Item 3: Main Step work (AREA)
  const i3 = await prisma.mBItem.create({
    data: { mbId: mb1.id, description: 'Main Step work', measurementType: 'AREA', unit: 'Sq.Ft', rate: 80, sortOrder: 2 },
  });
  const i3rows = [
    { desc: 'Tread',   nos: 1, l: 10, b: 7   },
    { desc: 'Riser',   nos: 1, l: 10, b: 7   },
    { desc: 'Landing', nos: 1, l: 10, b: 4.5 },
    { desc: 'Skirting',nos: 1, l: 28, b: 1   },
    { desc: 'Landing', nos: 1, l: 20, b: 1   },
  ];
  for (let idx = 0; idx < i3rows.length; idx++) {
    const r = i3rows[idx];
    await prisma.mBRow.create({ data: { itemId: i3.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, qty: r.nos * r.l * r.b, sortOrder: idx } });
  }
  const i3qty = i3rows.reduce((s, r) => s + r.nos * r.l * r.b, 0);
  await prisma.mBItem.update({ where: { id: i3.id }, data: { totalQty: i3qty, amount: i3qty * 80 } });

  // Item 4: Kota Stone work passage (AREA)
  const i4 = await prisma.mBItem.create({
    data: { mbId: mb1.id, description: 'Kota Stone work passage', measurementType: 'AREA', unit: 'Sq.Ft', rate: 90, sortOrder: 3 },
  });
  const i4rows = [
    { desc: 'Floor',      nos: 1, l: 38,  b: 6.75 },
    { desc: 'Skirting',   nos: 1, l: 114, b: 1    },
    { desc: 'Half Nosing',nos: 1, l: 34,  b: 1    },
  ];
  for (let idx = 0; idx < i4rows.length; idx++) {
    const r = i4rows[idx];
    await prisma.mBRow.create({ data: { itemId: i4.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, qty: r.nos * r.l * r.b, sortOrder: idx } });
  }
  const i4qty = i4rows.reduce((s, r) => s + r.nos * r.l * r.b, 0);
  await prisma.mBItem.update({ where: { id: i4.id }, data: { totalQty: i4qty, amount: i4qty * 90 } });

  // Item 5: Wash Basin Counter (NOS)
  const i5 = await prisma.mBItem.create({
    data: { mbId: mb1.id, description: 'Wash Basin Counter work', measurementType: 'NOS', unit: 'Nos', rate: 25000, sortOrder: 4 },
  });
  await prisma.mBRow.create({ data: { itemId: i5.id, description: '2-sink vanity units', nos: 5, qty: 5, sortOrder: 0 } });
  await prisma.mBItem.update({ where: { id: i5.id }, data: { totalQty: 5, amount: 125000 } });

  // Item 6: 2" Kota Stone work (AREA)
  const i6 = await prisma.mBItem.create({
    data: { mbId: mb1.id, description: '2" Kota Stone work', measurementType: 'AREA', unit: 'Sq.Ft', rate: 125, sortOrder: 5 },
  });
  const i6rows = [
    { desc: 'Floor – Block A', nos: 1, l: 31, b: 9.5  },
    { desc: 'Floor – Block B', nos: 1, l: 20, b: 8    },
    { desc: 'Passage',         nos: 1, l: 5.5,b: 4    },
  ];
  for (let idx = 0; idx < i6rows.length; idx++) {
    const r = i6rows[idx];
    await prisma.mBRow.create({ data: { itemId: i6.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, qty: r.nos * r.l * r.b, sortOrder: idx } });
  }
  const i6qty = i6rows.reduce((s, r) => s + r.nos * r.l * r.b, 0);
  await prisma.mBItem.update({ where: { id: i6.id }, data: { totalQty: i6qty, amount: i6qty * 125 } });

  // Recompute MB1 total
  const mb1items = await prisma.mBItem.findMany({ where: { mbId: mb1.id } });
  const mb1total = mb1items.reduce((s, i) => s + Number(i.amount), 0);
  await prisma.measurementBook.update({ where: { id: mb1.id }, data: { totalAmount: mb1total } });
  console.log(`  ✅ MB-003 (Tiling Work)     APPROVED  ₹${mb1total.toLocaleString('en-IN')}`);

  // ── Bill 2: SUBMITTED — Civil / Structural Work ───────────────────────────
  const mb2 = await prisma.measurementBook.create({
    data: {
      siteId: site.id,
      companyId: company.id,
      billNumber: 'MB-004',
      title: 'Civil & Structural Work — Running Bill 1',
      periodFrom: new Date('2026-04-01'),
      periodTo: new Date('2026-04-21'),
      status: 'SUBMITTED',
      submittedBy: admin.id,
      submittedAt: new Date('2026-04-22'),
      totalAmount: 0,
    },
  });

  // RCC Columns (VOLUME)
  const c1 = await prisma.mBItem.create({
    data: { mbId: mb2.id, description: 'RCC Columns (M20 concrete)', measurementType: 'VOLUME', unit: 'Cu.Ft', rate: 5500, sortOrder: 0 },
  });
  const c1rows = [
    { desc: 'Ground floor — C1-C4', nos: 4, l: 0.75, b: 0.75, h: 10 },
    { desc: 'Ground floor — C5-C8', nos: 4, l: 0.75, b: 0.75, h: 10 },
    { desc: 'First floor — C1-C8',  nos: 8, l: 0.75, b: 0.75, h: 9  },
  ];
  for (let idx = 0; idx < c1rows.length; idx++) {
    const r = c1rows[idx];
    const qty = r.nos * r.l * r.b * r.h;
    await prisma.mBRow.create({ data: { itemId: c1.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, height: r.h, qty, sortOrder: idx } });
  }
  const c1qty = c1rows.reduce((s, r) => s + r.nos * r.l * r.b * r.h, 0);
  await prisma.mBItem.update({ where: { id: c1.id }, data: { totalQty: c1qty, amount: c1qty * 5500 } });

  // Brick Masonry (VOLUME)
  const c2 = await prisma.mBItem.create({
    data: { mbId: mb2.id, description: 'Brick Masonry (9" wall)', measurementType: 'VOLUME', unit: 'Cu.Ft', rate: 950, sortOrder: 1 },
  });
  const c2rows = [
    { desc: 'External walls — Ground', nos: 1, l: 120, b: 0.75, h: 10 },
    { desc: 'Internal walls — Ground', nos: 1, l: 85,  b: 0.38, h: 10 },
    { desc: 'External walls — First',  nos: 1, l: 120, b: 0.75, h: 9  },
  ];
  for (let idx = 0; idx < c2rows.length; idx++) {
    const r = c2rows[idx];
    const qty = r.nos * r.l * r.b * r.h;
    await prisma.mBRow.create({ data: { itemId: c2.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, height: r.h, qty, sortOrder: idx } });
  }
  const c2qty = c2rows.reduce((s, r) => s + r.nos * r.l * r.b * r.h, 0);
  await prisma.mBItem.update({ where: { id: c2.id }, data: { totalQty: c2qty, amount: c2qty * 950 } });

  // Plastering external (AREA)
  const c3 = await prisma.mBItem.create({
    data: { mbId: mb2.id, description: 'External Plastering (18mm, CM 1:4)', measurementType: 'AREA', unit: 'Sq.Ft', rate: 28, sortOrder: 2 },
  });
  const c3rows = [
    { desc: 'North elevation', nos: 1, l: 45, b: 19 },
    { desc: 'South elevation', nos: 1, l: 45, b: 19 },
    { desc: 'East elevation',  nos: 1, l: 32, b: 19 },
    { desc: 'West elevation',  nos: 1, l: 32, b: 19 },
  ];
  for (let idx = 0; idx < c3rows.length; idx++) {
    const r = c3rows[idx];
    await prisma.mBRow.create({ data: { itemId: c3.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, qty: r.nos * r.l * r.b, sortOrder: idx } });
  }
  const c3qty = c3rows.reduce((s, r) => s + r.nos * r.l * r.b, 0);
  await prisma.mBItem.update({ where: { id: c3.id }, data: { totalQty: c3qty, amount: c3qty * 28 } });

  // Excavation (VOLUME)
  const c4 = await prisma.mBItem.create({
    data: { mbId: mb2.id, description: 'Earthwork Excavation for Foundation', measurementType: 'VOLUME', unit: 'Cu.Mt', rate: 380, sortOrder: 3 },
  });
  const c4rows = [
    { desc: 'Trench A — North',  nos: 1, l: 12.5, b: 1.2, h: 1.8 },
    { desc: 'Trench B — South',  nos: 1, l: 12.5, b: 1.2, h: 1.8 },
    { desc: 'Trench C — East',   nos: 1, l: 9.0,  b: 1.2, h: 1.8 },
    { desc: 'Trench D — West',   nos: 1, l: 9.0,  b: 1.2, h: 1.8 },
    { desc: 'Pit — Centre',      nos: 1, l: 6.0,  b: 4.0, h: 2.5 },
  ];
  for (let idx = 0; idx < c4rows.length; idx++) {
    const r = c4rows[idx];
    const qty = r.nos * r.l * r.b * r.h;
    await prisma.mBRow.create({ data: { itemId: c4.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, height: r.h, qty, sortOrder: idx } });
  }
  const c4qty = c4rows.reduce((s, r) => s + r.nos * r.l * r.b * r.h, 0);
  await prisma.mBItem.update({ where: { id: c4.id }, data: { totalQty: c4qty, amount: c4qty * 380 } });

  // Recompute MB2 total
  const mb2items = await prisma.mBItem.findMany({ where: { mbId: mb2.id } });
  const mb2total = mb2items.reduce((s, i) => s + Number(i.amount), 0);
  await prisma.measurementBook.update({ where: { id: mb2.id }, data: { totalAmount: mb2total } });
  console.log(`  ✅ MB-004 (Civil Work)       SUBMITTED ₹${mb2total.toLocaleString('en-IN')}`);

  // ── Bill 3: DRAFT — Plumbing & Sanitary ──────────────────────────────────
  const mb3 = await prisma.measurementBook.create({
    data: {
      siteId: site.id,
      companyId: company.id,
      billNumber: 'MB-005',
      title: 'Plumbing & Sanitary Fittings',
      periodFrom: new Date('2026-04-10'),
      periodTo: new Date('2026-04-26'),
      status: 'DRAFT',
      totalAmount: 0,
    },
  });

  // UPVC pipes (LENGTH)
  const p1 = await prisma.mBItem.create({
    data: { mbId: mb3.id, description: 'UPVC Soil Pipe (4" dia)', measurementType: 'LENGTH', unit: 'Rft', rate: 145, sortOrder: 0 },
  });
  const p1rows = [
    { desc: 'Ground floor — W1 to manhole', nos: 1, l: 18 },
    { desc: 'First floor — W1 to stack',    nos: 1, l: 12 },
    { desc: 'First floor — W2 to stack',    nos: 1, l: 9  },
    { desc: 'Stack pipe — vertical',        nos: 1, l: 22 },
  ];
  for (let idx = 0; idx < p1rows.length; idx++) {
    const r = p1rows[idx];
    await prisma.mBRow.create({ data: { itemId: p1.id, description: r.desc, nos: r.nos, length: r.l, qty: r.nos * r.l, sortOrder: idx } });
  }
  const p1qty = p1rows.reduce((s, r) => s + r.nos * r.l, 0);
  await prisma.mBItem.update({ where: { id: p1.id }, data: { totalQty: p1qty, amount: p1qty * 145 } });

  // Sanitary fittings (NOS)
  const p2 = await prisma.mBItem.create({
    data: { mbId: mb3.id, description: 'Water Closet (EWC, Hindware)', measurementType: 'NOS', unit: 'Nos', rate: 8500, sortOrder: 1 },
  });
  await prisma.mBRow.create({ data: { itemId: p2.id, description: 'All floors — 4 bathrooms', nos: 8, qty: 8, sortOrder: 0 } });
  await prisma.mBItem.update({ where: { id: p2.id }, data: { totalQty: 8, amount: 68000 } });

  const p3 = await prisma.mBItem.create({
    data: { mbId: mb3.id, description: 'Wash Hand Basin (pedestal, Parryware)', measurementType: 'NOS', unit: 'Nos', rate: 4200, sortOrder: 2 },
  });
  await prisma.mBRow.create({ data: { itemId: p3.id, description: 'All floors — 4 bathrooms + kitchen', nos: 6, qty: 6, sortOrder: 0 } });
  await prisma.mBItem.update({ where: { id: p3.id }, data: { totalQty: 6, amount: 25200 } });

  // CPVC water supply (LENGTH)
  const p4 = await prisma.mBItem.create({
    data: { mbId: mb3.id, description: 'CPVC Hot & Cold Water Supply (3/4")', measurementType: 'LENGTH', unit: 'Rft', rate: 95, sortOrder: 3 },
  });
  const p4rows = [
    { desc: 'Ground floor — main line',  nos: 1, l: 35 },
    { desc: 'First floor — main line',   nos: 1, l: 35 },
    { desc: 'Branch lines — all rooms',  nos: 8, l: 12 },
  ];
  for (let idx = 0; idx < p4rows.length; idx++) {
    const r = p4rows[idx];
    await prisma.mBRow.create({ data: { itemId: p4.id, description: r.desc, nos: r.nos, length: r.l, qty: r.nos * r.l, sortOrder: idx } });
  }
  const p4qty = p4rows.reduce((s, r) => s + r.nos * r.l, 0);
  await prisma.mBItem.update({ where: { id: p4.id }, data: { totalQty: p4qty, amount: p4qty * 95 } });

  // Recompute MB3 total
  const mb3items = await prisma.mBItem.findMany({ where: { mbId: mb3.id } });
  const mb3total = mb3items.reduce((s, i) => s + Number(i.amount), 0);
  await prisma.measurementBook.update({ where: { id: mb3.id }, data: { totalAmount: mb3total } });
  console.log(`  ✅ MB-005 (Plumbing)         DRAFT     ₹${mb3total.toLocaleString('en-IN')}`);

  // ── Bill 4: REJECTED — Painting Work ─────────────────────────────────────
  const mb4 = await prisma.measurementBook.create({
    data: {
      siteId: site.id,
      companyId: company.id,
      billNumber: 'MB-006',
      title: 'Painting — Internal & External',
      periodFrom: new Date('2026-04-15'),
      periodTo: new Date('2026-04-24'),
      status: 'REJECTED',
      submittedBy: admin.id,
      submittedAt: new Date('2026-04-25'),
      reviewedBy: admin.id,
      reviewedAt: new Date('2026-04-26'),
      reviewNote: 'Quantities for external walls appear overstated. Ceiling height used as 12ft but approved drawings show 10ft. Please revise and resubmit.',
      totalAmount: 0,
    },
  });

  const pt1 = await prisma.mBItem.create({
    data: { mbId: mb4.id, description: 'External Painting (2 coats Apex Weatherproof)', measurementType: 'AREA', unit: 'Sq.Ft', rate: 22, sortOrder: 0 },
  });
  const pt1rows = [
    { desc: 'North façade', nos: 1, l: 45, b: 12 },
    { desc: 'South façade', nos: 1, l: 45, b: 12 },
    { desc: 'East façade',  nos: 1, l: 32, b: 12 },
    { desc: 'West façade',  nos: 1, l: 32, b: 12 },
  ];
  for (let idx = 0; idx < pt1rows.length; idx++) {
    const r = pt1rows[idx];
    await prisma.mBRow.create({ data: { itemId: pt1.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, qty: r.nos * r.l * r.b, sortOrder: idx } });
  }
  const pt1qty = pt1rows.reduce((s, r) => s + r.nos * r.l * r.b, 0);
  await prisma.mBItem.update({ where: { id: pt1.id }, data: { totalQty: pt1qty, amount: pt1qty * 22 } });

  const pt2 = await prisma.mBItem.create({
    data: { mbId: mb4.id, description: 'Internal Painting — Putty + 2 coats emulsion', measurementType: 'AREA', unit: 'Sq.Ft', rate: 18, sortOrder: 1 },
  });
  const pt2rows = [
    { desc: 'All rooms — walls',    nos: 1, l: 480, b: 10 },
    { desc: 'All rooms — ceilings', nos: 1, l: 280, b: 1  },
  ];
  for (let idx = 0; idx < pt2rows.length; idx++) {
    const r = pt2rows[idx];
    await prisma.mBRow.create({ data: { itemId: pt2.id, description: r.desc, nos: r.nos, length: r.l, breadth: r.b, qty: r.nos * r.l * r.b, sortOrder: idx } });
  }
  const pt2qty = pt2rows.reduce((s, r) => s + r.nos * r.l * r.b, 0);
  await prisma.mBItem.update({ where: { id: pt2.id }, data: { totalQty: pt2qty, amount: pt2qty * 18 } });

  const mb4items = await prisma.mBItem.findMany({ where: { mbId: mb4.id } });
  const mb4total = mb4items.reduce((s, i) => s + Number(i.amount), 0);
  await prisma.measurementBook.update({ where: { id: mb4.id }, data: { totalAmount: mb4total } });
  console.log(`  ✅ MB-006 (Painting)         REJECTED  ₹${mb4total.toLocaleString('en-IN')}`);

  console.log('\n✅ MB seed complete!');
  console.log(`\nGo to app.workpik.in/mb → select "${site.name}" to see all 4 bills.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

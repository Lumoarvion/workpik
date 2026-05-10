import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.alert.deleteMany();
  await prisma.report.deleteMany();
  await prisma.submissionPhoto.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.siteClient.deleteMany();
  await prisma.siteManager.deleteMany();
  await prisma.siteWorker.deleteMany();
  await prisma.siteWorkType.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.workType.deleteMany();
  await prisma.site.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // Company
  const company = await prisma.company.create({
    data: {
      name: 'CleanPro Facility Services',
      address: 'HSR Layout, Bangalore, Karnataka 560102',
      phone: '9876500000',
      email: 'info@cleanpro.com',
      planType: 'professional',
      settings: { timezone: 'Asia/Kolkata', reportTime: '19:00' },
    },
  });
  console.log('Created company:', company.name);

  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const managerHash = await bcrypt.hash('Manager@123', 12);
  const clientHash = await bcrypt.hash('Client@123', 12);

  // Users
  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'admin@cleanpro.com',
      passwordHash,
      fullName: 'Rajesh Kumar',
      phone: '9876500001',
      role: 'ADMIN',
    },
  });

  const manager = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'priya@cleanpro.com',
      passwordHash: managerHash,
      fullName: 'Priya Sharma',
      phone: '9876500002',
      role: 'MANAGER',
    },
  });

  const client = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'client@abcsociety.com',
      passwordHash: clientHash,
      fullName: 'Suresh Patel',
      phone: '9876500003',
      role: 'CLIENT',
    },
  });
  console.log('Created users: admin, manager, client');

  // Work Types
  const workTypeData = [
    { name: 'Cleaning', icon: '🧹', sortOrder: 0 },
    { name: 'Security Patrol', icon: '🔒', sortOrder: 1 },
    { name: 'Maintenance', icon: '🔧', sortOrder: 2 },
    { name: 'Inspection', icon: '🔍', sortOrder: 3 },
    { name: 'Gardening', icon: '🌿', sortOrder: 4 },
    { name: 'Pest Control', icon: '🐛', sortOrder: 5 },
  ];
  const workTypes = await Promise.all(
    workTypeData.map((wt) =>
      prisma.workType.create({ data: { companyId: company.id, ...wt, isDefault: true } })
    )
  );
  console.log('Created', workTypes.length, 'work types');

  // Sites
  const site1 = await prisma.site.create({
    data: {
      companyId: company.id,
      name: 'Prestige Towers — Block A',
      address: 'Prestige Towers, Outer Ring Road, Marathahalli, Bangalore 560037',
      latitude: 12.9568,
      longitude: 77.7011,
      gpsRadiusMetres: 200,
      minPhotosPerDay: 5,
      beforeAfterEnabled: true,
      expectedStartTime: '08:00',
      expectedEndTime: '18:00',
      contactName: 'Anand Reddy',
      contactPhone: '9876500010',
    },
  });

  const site2 = await prisma.site.create({
    data: {
      companyId: company.id,
      name: 'ABC Housing Society',
      address: 'ABC Society, Koramangala, Bangalore 560034',
      latitude: 12.9352,
      longitude: 77.6245,
      gpsRadiusMetres: 150,
      minPhotosPerDay: 3,
      expectedStartTime: '07:00',
      expectedEndTime: '19:00',
      contactName: 'Meera Iyer',
      contactPhone: '9876500011',
    },
  });

  const site3 = await prisma.site.create({
    data: {
      companyId: company.id,
      name: 'TechPark Phase 2',
      address: 'TechPark, Electronic City, Bangalore 560100',
      latitude: 12.8456,
      longitude: 77.6603,
      gpsRadiusMetres: 250,
      minPhotosPerDay: 4,
      expectedStartTime: '06:00',
      expectedEndTime: '22:00',
      contactName: 'Vikram Singh',
      contactPhone: '9876500012',
    },
  });
  console.log('Created 3 sites');

  // Zones
  const site1Zones = await Promise.all([
    prisma.zone.create({ data: { siteId: site1.id, name: 'Lobby', sortOrder: 0 } }),
    prisma.zone.create({ data: { siteId: site1.id, name: 'Floor 1', sortOrder: 1 } }),
    prisma.zone.create({ data: { siteId: site1.id, name: 'Floor 2', sortOrder: 2 } }),
    prisma.zone.create({ data: { siteId: site1.id, name: 'Floor 3', sortOrder: 3 } }),
    prisma.zone.create({ data: { siteId: site1.id, name: 'Parking', sortOrder: 4 } }),
  ]);

  const site2Zones = await Promise.all([
    prisma.zone.create({ data: { siteId: site2.id, name: 'Clubhouse', sortOrder: 0 } }),
    prisma.zone.create({ data: { siteId: site2.id, name: 'Garden', sortOrder: 1 } }),
    prisma.zone.create({ data: { siteId: site2.id, name: 'Building Entrance', sortOrder: 2 } }),
    prisma.zone.create({ data: { siteId: site2.id, name: 'Parking', sortOrder: 3 } }),
  ]);

  const site3Zones = await Promise.all([
    prisma.zone.create({ data: { siteId: site3.id, name: 'Reception', sortOrder: 0 } }),
    prisma.zone.create({ data: { siteId: site3.id, name: 'Cafeteria', sortOrder: 1 } }),
    prisma.zone.create({ data: { siteId: site3.id, name: 'Washrooms', sortOrder: 2 } }),
  ]);

  // Assign work types to sites
  const allSites = [site1, site2, site3];
  for (const site of allSites) {
    for (const wt of workTypes) {
      await prisma.siteWorkType.create({ data: { siteId: site.id, workTypeId: wt.id } });
    }
  }

  // Workers
  const workerNames = [
    { name: 'Raju Kumar', phone: '9876543210' },
    { name: 'Sunil Yadav', phone: '9876543211' },
    { name: 'Lakshmi Devi', phone: '9876543212' },
    { name: 'Manoj Verma', phone: '9876543213' },
    { name: 'Sunita Bai', phone: '9876543214' },
    { name: 'Ramesh Gowda', phone: '9876543215' },
    { name: 'Kavitha Naik', phone: '9876543216' },
    { name: 'Arun Prasad', phone: '9876543217' },
  ];

  const workers = await Promise.all(
    workerNames.map((w) =>
      prisma.worker.create({
        data: { companyId: company.id, name: w.name, phone: w.phone, status: 'ACTIVE' },
      })
    )
  );
  console.log('Created', workers.length, 'workers');

  // Assign workers to sites
  // Site 1: 4 workers
  for (let i = 0; i < 4; i++) {
    await prisma.siteWorker.create({ data: { siteId: site1.id, workerId: workers[i].id } });
  }
  // Site 2: 3 workers
  for (let i = 2; i < 5; i++) {
    await prisma.siteWorker.create({ data: { siteId: site2.id, workerId: workers[i].id } });
  }
  // Site 3: 3 workers
  for (let i = 5; i < 8; i++) {
    await prisma.siteWorker.create({ data: { siteId: site3.id, workerId: workers[i].id } });
  }

  // Assign manager to sites 1 and 2
  await prisma.siteManager.create({ data: { siteId: site1.id, userId: manager.id } });
  await prisma.siteManager.create({ data: { siteId: site2.id, userId: manager.id } });

  // Assign client to site 2
  await prisma.siteClient.create({ data: { siteId: site2.id, userId: client.id } });

  // Generate submissions (100+ over 7 days)
  const notes = [
    'Mopped lobby area', 'Checked CCTV cameras', 'Replaced bulb in staircase',
    'Cleaned washrooms', 'Watered garden plants', 'Checked fire extinguishers',
    'Swept parking area', 'Dusted reception desk', 'Cleaned cafeteria tables',
    'Checked entry gates', 'Pest spray in kitchen', 'Repaired AC unit',
    'Cleaned windows', 'Security round completed', 'Replaced soap dispensers',
    'Trimmed hedge', 'Fixed leaking tap', 'Replaced light tube',
    'Floor scrubbing done', 'Checked elevator operation',
  ];

  const allZones = [...site1Zones, ...site2Zones, ...site3Zones];
  const siteZoneMap: Record<string, typeof allZones> = {
    [site1.id]: site1Zones,
    [site2.id]: site2Zones,
    [site3.id]: site3Zones,
  };

  const siteWorkerMap: Record<string, string[]> = {
    [site1.id]: workers.slice(0, 4).map((w) => w.id),
    [site2.id]: workers.slice(2, 5).map((w) => w.id),
    [site3.id]: workers.slice(5, 8).map((w) => w.id),
  };

  let submissionCount = 0;
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);

    for (const site of allSites) {
      const siteWorkers = siteWorkerMap[site.id];
      const siteZones = siteZoneMap[site.id];
      const subsPerDay = dayOffset === 0 ? 8 : 5 + Math.floor(Math.random() * 5);

      for (let s = 0; s < subsPerDay; s++) {
        const workerId = siteWorkers[Math.floor(Math.random() * siteWorkers.length)];
        const zone = siteZones[Math.floor(Math.random() * siteZones.length)];
        const workType = workTypes[Math.floor(Math.random() * workTypes.length)];
        const note = notes[Math.floor(Math.random() * notes.length)];

        const hour = 7 + Math.floor(Math.random() * 11);
        const minute = Math.floor(Math.random() * 60);
        const deviceTimestamp = new Date(date);
        deviceTimestamp.setHours(hour, minute, 0, 0);

        // Most within radius, a few outside
        const isOutside = Math.random() < 0.08;
        const lat = (site.latitude || 12.95) + (isOutside ? 0.005 : (Math.random() - 0.5) * 0.001);
        const lng = (site.longitude || 77.65) + (isOutside ? 0.005 : (Math.random() - 0.5) * 0.001);

        const isFlagged = Math.random() < 0.04;

        const submission = await prisma.submission.create({
          data: {
            siteId: site.id,
            workerId,
            workTypeId: workType.id,
            zoneId: zone.id,
            note,
            latitude: lat,
            longitude: lng,
            gpsAccuracyM: 5 + Math.random() * 20,
            isWithinRadius: !isOutside,
            distanceFromSite: isOutside ? 500 + Math.random() * 500 : Math.random() * 100,
            deviceTimestamp,
            status: isFlagged ? 'FLAGGED' : 'SUBMITTED',
            flagReason: isFlagged ? 'Photo appears blurry' : null,
            flaggedBy: isFlagged ? admin.id : null,
          },
        });

        // 1-3 photos per submission (use placeholder keys)
        const photoCount = 1 + Math.floor(Math.random() * 3);
        for (let p = 0; p < photoCount; p++) {
          await prisma.submissionPhoto.create({
            data: {
              submissionId: submission.id,
              photoUrl: `submissions/${site.id}/${deviceTimestamp.getTime()}-${p}-photo.jpg`,
              thumbnailUrl: `submissions/${site.id}/${deviceTimestamp.getTime()}-${p}-thumb.jpg`,
              originalWidth: 1920,
              originalHeight: 1080,
              fileSizeBytes: 500000 + Math.floor(Math.random() * 1500000),
              sortOrder: p,
            },
          });
        }
        submissionCount++;
      }
    }
  }
  console.log('Created', submissionCount, 'submissions');

  // Issues
  const issueData = [
    { category: 'Equipment Damage', severity: 'URGENT' as const, description: 'Floor scrubber machine not starting', status: 'OPEN' as const, siteIdx: 0, workerIdx: 0 },
    { category: 'Safety Hazard', severity: 'MEDIUM' as const, description: 'Wet floor near elevator — needs warning sign', status: 'OPEN' as const, siteIdx: 0, workerIdx: 1 },
    { category: 'Material Needed', severity: 'LOW' as const, description: 'Running low on cleaning supplies', status: 'ACKNOWLEDGED' as const, siteIdx: 1, workerIdx: 2 },
    { category: 'Client Complaint', severity: 'HIGH' as const, description: 'Resident complained about noise during early morning cleaning', status: 'ACKNOWLEDGED' as const, siteIdx: 1, workerIdx: 3 },
    { category: 'Equipment Damage', severity: 'MEDIUM' as const, description: 'Broken door handle in washroom', status: 'RESOLVED' as const, siteIdx: 2, workerIdx: 5 },
  ];

  for (const issue of issueData) {
    const site = allSites[issue.siteIdx];
    await prisma.issue.create({
      data: {
        siteId: site.id,
        workerId: workers[issue.workerIdx].id,
        category: issue.category,
        severity: issue.severity,
        status: issue.status,
        description: issue.description,
        photoUrl: `issues/${site.id}/issue-photo.jpg`,
        latitude: site.latitude,
        longitude: site.longitude,
        response: issue.status !== 'OPEN' ? 'Looking into this issue' : null,
        respondedBy: issue.status !== 'OPEN' ? manager.id : null,
        respondedAt: issue.status !== 'OPEN' ? new Date() : null,
        resolvedAt: issue.status === 'RESOLVED' ? new Date() : null,
        resolutionPhotoUrl: issue.status === 'RESOLVED' ? `issues/${site.id}/resolution-photo.jpg` : null,
      },
    });
  }
  console.log('Created 5 issues');

  // Alerts
  const alertData = [
    { siteId: site1.id, alertType: 'worker_inactive', title: 'Worker Raju Kumar inactive today', isRead: false },
    { siteId: site1.id, alertType: 'gps_mismatch', title: 'GPS mismatch: photo taken 520m from site', isRead: false },
    { siteId: site2.id, alertType: 'min_photos_not_met', title: 'ABC Housing: only 2 of 3 required photos submitted', isRead: false },
    { siteId: site2.id, alertType: 'urgent_issue', title: 'Urgent: Equipment Damage reported', isRead: false },
    { siteId: site3.id, alertType: 'worker_inactive', title: 'Worker Kavitha Naik inactive today', isRead: false },
    { siteId: site3.id, alertType: 'gps_mismatch', title: 'GPS mismatch detected at TechPark', isRead: false },
    { siteId: site1.id, alertType: 'worker_inactive', title: 'Worker Sunil Yadav not active since morning', isRead: true },
    { siteId: site1.id, alertType: 'min_photos_not_met', title: 'Prestige Towers: minimum photos not met yesterday', isRead: true },
    { siteId: site2.id, alertType: 'gps_mismatch', title: 'Old GPS mismatch — reviewed and OK', isRead: true },
    { siteId: site3.id, alertType: 'worker_inactive', title: 'Worker Arun Prasad inactive — resolved', isRead: true },
  ];

  for (const alert of alertData) {
    await prisma.alert.create({ data: alert });
  }
  console.log('Created 10 alerts');

  // Reports
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  await prisma.report.create({
    data: {
      companyId: company.id,
      siteId: site1.id,
      reportType: 'DAILY',
      reportDate: yesterday,
      periodStart: yesterday,
      periodEnd: yesterday,
      data: { totalSubmissions: 12, workerStats: [], issueCount: 1 },
      shareToken: crypto.randomBytes(32).toString('hex'),
      deliveryStatus: 'GENERATED',
      deliveredTo: [],
    },
  });

  await prisma.report.create({
    data: {
      companyId: company.id,
      siteId: site2.id,
      reportType: 'DAILY',
      reportDate: twoDaysAgo,
      periodStart: twoDaysAgo,
      periodEnd: twoDaysAgo,
      data: { totalSubmissions: 8, workerStats: [], issueCount: 0 },
      shareToken: crypto.randomBytes(32).toString('hex'),
      deliveryStatus: 'SENT',
      deliveredTo: ['client@abcsociety.com'],
    },
  });

  await prisma.report.create({
    data: {
      companyId: company.id,
      siteId: site1.id,
      reportType: 'WEEKLY',
      reportDate: weekStart,
      periodStart: weekStart,
      periodEnd: yesterday,
      data: { totalSubmissions: 65, workerStats: [], issueCount: 3 },
      shareToken: crypto.randomBytes(32).toString('hex'),
      deliveryStatus: 'GENERATED',
      deliveredTo: [],
    },
  });
  console.log('Created 3 reports');

  console.log('\nSeed complete!');
  console.log('Login credentials:');
  console.log('  Admin:   admin@cleanpro.com / Admin@123');
  console.log('  Manager: priya@cleanpro.com / Manager@123');
  console.log('  Client:  client@abcsociety.com / Client@123');
  console.log('  Worker:  9876543210 / OTP: 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

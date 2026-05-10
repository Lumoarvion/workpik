-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CLIENT');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING_SYNC', 'SUBMITTED', 'FLAGGED', 'RETAKE_REQUESTED');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ReportDeliveryStatus" AS ENUM ('PENDING', 'GENERATED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "logo" VARCHAR(500),
    "address" TEXT,
    "phone" VARCHAR(15),
    "email" VARCHAR(255),
    "gstNumber" VARCHAR(15),
    "planType" VARCHAR(20) NOT NULL DEFAULT 'free',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(256) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(15),
    "role" "UserRole" NOT NULL DEFAULT 'MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "photo" VARCHAR(500),
    "language" VARCHAR(5) NOT NULL DEFAULT 'en',
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceId" VARCHAR(255),
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gpsRadiusMetres" INTEGER NOT NULL DEFAULT 200,
    "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "minPhotosPerDay" INTEGER NOT NULL DEFAULT 1,
    "beforeAfterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "expectedStartTime" VARCHAR(5),
    "expectedEndTime" VARCHAR(5),
    "contactName" VARCHAR(255),
    "contactPhone" VARCHAR(15),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_types" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_work_types" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "workTypeId" UUID NOT NULL,

    CONSTRAINT "site_work_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_workers" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_managers" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "site_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_clients" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "site_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "workTypeId" UUID NOT NULL,
    "zoneId" UUID,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "voiceNoteUrl" VARCHAR(500),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "gpsAccuracyM" DOUBLE PRECISION,
    "isWithinRadius" BOOLEAN NOT NULL DEFAULT true,
    "distanceFromSite" DOUBLE PRECISION,
    "deviceId" VARCHAR(255),
    "deviceTimestamp" TIMESTAMP(3) NOT NULL,
    "serverTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBeforePhoto" BOOLEAN NOT NULL DEFAULT false,
    "linkedSubmissionId" UUID,
    "flagReason" TEXT,
    "flaggedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_photos" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "photoUrl" VARCHAR(500) NOT NULL,
    "thumbnailUrl" VARCHAR(500),
    "originalWidth" INTEGER,
    "originalHeight" INTEGER,
    "fileSizeBytes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "photoUrl" VARCHAR(500),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "response" TEXT,
    "respondedBy" UUID,
    "respondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionPhotoUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "reportDate" DATE NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "pdfUrl" VARCHAR(500),
    "shareToken" VARCHAR(64),
    "deliveryStatus" "ReportDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredTo" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "alertType" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_companyId_email_key" ON "users"("companyId", "email");

-- CreateIndex
CREATE INDEX "workers_companyId_status_idx" ON "workers"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workers_companyId_phone_key" ON "workers"("companyId", "phone");

-- CreateIndex
CREATE INDEX "sites_companyId_status_idx" ON "sites"("companyId", "status");

-- CreateIndex
CREATE INDEX "zones_siteId_idx" ON "zones"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "work_types_companyId_name_key" ON "work_types"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "site_work_types_siteId_workTypeId_key" ON "site_work_types"("siteId", "workTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "site_workers_siteId_workerId_key" ON "site_workers"("siteId", "workerId");

-- CreateIndex
CREATE UNIQUE INDEX "site_managers_siteId_userId_key" ON "site_managers"("siteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "site_clients_siteId_userId_key" ON "site_clients"("siteId", "userId");

-- CreateIndex
CREATE INDEX "submissions_siteId_createdAt_idx" ON "submissions"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "submissions_workerId_createdAt_idx" ON "submissions"("workerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "submissions_siteId_workTypeId_createdAt_idx" ON "submissions"("siteId", "workTypeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "submission_photos_submissionId_idx" ON "submission_photos"("submissionId");

-- CreateIndex
CREATE INDEX "issues_siteId_status_createdAt_idx" ON "issues"("siteId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reports_shareToken_key" ON "reports"("shareToken");

-- CreateIndex
CREATE INDEX "reports_siteId_reportType_reportDate_idx" ON "reports"("siteId", "reportType", "reportDate" DESC);

-- CreateIndex
CREATE INDEX "alerts_siteId_isRead_createdAt_idx" ON "alerts"("siteId", "isRead", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workers" ADD CONSTRAINT "workers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_types" ADD CONSTRAINT "work_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_work_types" ADD CONSTRAINT "site_work_types_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_work_types" ADD CONSTRAINT "site_work_types_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_workers" ADD CONSTRAINT "site_workers_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_workers" ADD CONSTRAINT "site_workers_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_managers" ADD CONSTRAINT "site_managers_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_managers" ADD CONSTRAINT "site_managers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_clients" ADD CONSTRAINT "site_clients_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_clients" ADD CONSTRAINT "site_clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_photos" ADD CONSTRAINT "submission_photos_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

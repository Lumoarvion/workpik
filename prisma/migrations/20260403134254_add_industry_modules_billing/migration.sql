-- CreateEnum
CREATE TYPE "Industry" AS ENUM ('CONSTRUCTION', 'FACILITY_MANAGEMENT', 'HOME_SERVICES', 'SOLAR_INSTALLATION', 'SECURITY_PATROL', 'LOGISTICS_DELIVERY', 'GENERAL');

-- CreateEnum
CREATE TYPE "WeatherCondition" AS ENUM ('CLEAR', 'CLOUDY', 'RAIN', 'STORM', 'WINDY', 'HOT', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentOwnership" AS ENUM ('OWNED', 'RENTED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "enabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "industry" "Industry",
ADD COLUMN     "onboardingDone" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "submission_share_links" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "daily_site_logs" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "logDate" DATE NOT NULL,
    "weather" "WeatherCondition",
    "weatherNote" TEXT,
    "crewCount" INTEGER,
    "workSummary" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_site_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_logs" (
    "id" UUID NOT NULL,
    "dailyLogId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "EquipmentOwnership" NOT NULL DEFAULT 'RENTED',
    "hoursUsed" DECIMAL(6,2),
    "rentalCostPerHour" DECIMAL(10,2),
    "totalCost" DECIMAL(12,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_logs" (
    "id" UUID NOT NULL,
    "dailyLogId" UUID NOT NULL,
    "item" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "unitCost" DECIMAL(10,2),
    "totalCost" DECIMAL(12,2),
    "vendor" VARCHAR(255),
    "invoiceNumber" VARCHAR(100),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labour_logs" (
    "id" UUID NOT NULL,
    "dailyLogId" UUID NOT NULL,
    "workerId" UUID,
    "workerName" VARCHAR(255) NOT NULL,
    "role" VARCHAR(100) NOT NULL,
    "hoursWorked" DECIMAL(5,2),
    "dailyWage" DECIMAL(10,2),
    "overtime" DECIMAL(5,2),
    "overtimeRate" DECIMAL(10,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labour_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_photos" (
    "id" UUID NOT NULL,
    "dailyLogId" UUID,
    "equipmentLogId" UUID,
    "materialLogId" UUID,
    "photoUrl" VARCHAR(500) NOT NULL,
    "thumbnailUrl" VARCHAR(500),
    "caption" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_site_logs_siteId_logDate_idx" ON "daily_site_logs"("siteId", "logDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_site_logs_siteId_logDate_key" ON "daily_site_logs"("siteId", "logDate");

-- CreateIndex
CREATE INDEX "equipment_logs_dailyLogId_idx" ON "equipment_logs"("dailyLogId");

-- CreateIndex
CREATE INDEX "material_logs_dailyLogId_idx" ON "material_logs"("dailyLogId");

-- CreateIndex
CREATE INDEX "labour_logs_dailyLogId_idx" ON "labour_logs"("dailyLogId");

-- AddForeignKey
ALTER TABLE "daily_site_logs" ADD CONSTRAINT "daily_site_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_site_logs" ADD CONSTRAINT "daily_site_logs_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_logs" ADD CONSTRAINT "equipment_logs_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "daily_site_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_logs" ADD CONSTRAINT "material_logs_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "daily_site_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labour_logs" ADD CONSTRAINT "labour_logs_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "daily_site_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labour_logs" ADD CONSTRAINT "labour_logs_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_photos" ADD CONSTRAINT "billing_photos_dailyLogId_fkey" FOREIGN KEY ("dailyLogId") REFERENCES "daily_site_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_photos" ADD CONSTRAINT "billing_photos_equipmentLogId_fkey" FOREIGN KEY ("equipmentLogId") REFERENCES "equipment_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_photos" ADD CONSTRAINT "billing_photos_materialLogId_fkey" FOREIGN KEY ("materialLogId") REFERENCES "material_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

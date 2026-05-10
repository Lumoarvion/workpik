-- CreateEnum
CREATE TYPE "MBStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('AREA', 'VOLUME', 'LENGTH', 'NOS', 'LUMP_SUM');

-- CreateTable
CREATE TABLE "measurement_books" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "billNumber" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255),
    "periodFrom" DATE,
    "periodTo" DATE,
    "status" "MBStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedBy" UUID,
    "submittedAt" TIMESTAMP(3),
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "measurement_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mb_items" (
    "id" UUID NOT NULL,
    "mbId" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "measurementType" "MeasurementType" NOT NULL,
    "rate" DECIMAL(12,2),
    "totalQty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mb_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mb_rows" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "description" VARCHAR(255),
    "nos" DECIMAL(8,2) NOT NULL DEFAULT 1,
    "length" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "breadth" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "height" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "qty" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mb_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "measurement_books_siteId_status_createdAt_idx" ON "measurement_books"("siteId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "measurement_books_companyId_status_idx" ON "measurement_books"("companyId", "status");

-- CreateIndex
CREATE INDEX "mb_items_mbId_sortOrder_idx" ON "mb_items"("mbId", "sortOrder");

-- CreateIndex
CREATE INDEX "mb_rows_itemId_sortOrder_idx" ON "mb_rows"("itemId", "sortOrder");

-- AddForeignKey
ALTER TABLE "measurement_books" ADD CONSTRAINT "measurement_books_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mb_items" ADD CONSTRAINT "mb_items_mbId_fkey" FOREIGN KEY ("mbId") REFERENCES "measurement_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mb_rows" ADD CONSTRAINT "mb_rows_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "mb_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

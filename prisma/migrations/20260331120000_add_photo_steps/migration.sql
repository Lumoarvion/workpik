-- AlterTable: Add photoSteps to work_types
ALTER TABLE "work_types" ADD COLUMN "photoSteps" JSONB;

-- AlterTable: Add per-photo metadata to submission_photos
ALTER TABLE "submission_photos" ADD COLUMN "photoStepId" VARCHAR(100);
ALTER TABLE "submission_photos" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "submission_photos" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "submission_photos" ADD COLUMN "capturedAt" TIMESTAMP(3);

-- CreateTable: submission_share_links
CREATE TABLE "submission_share_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submissionId" UUID NOT NULL,
    "shareToken" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_share_links_shareToken_key" ON "submission_share_links"("shareToken");

-- AddForeignKey
ALTER TABLE "submission_share_links" ADD CONSTRAINT "submission_share_links_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

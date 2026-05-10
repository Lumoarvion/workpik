-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "customData" JSONB;

-- AlterTable
ALTER TABLE "work_types" ADD COLUMN     "customFields" JSONB;

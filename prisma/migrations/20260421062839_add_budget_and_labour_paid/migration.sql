-- AlterTable
ALTER TABLE "labour_logs" ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidBy" VARCHAR(255);

-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "budget" DECIMAL(14,2);

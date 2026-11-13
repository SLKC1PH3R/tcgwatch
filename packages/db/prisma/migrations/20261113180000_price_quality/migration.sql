
-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'CARD_PRICE';

-- AlterTable
ALTER TABLE "AlertEvent" ADD COLUMN     "chaseCardId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChaseCard" ADD COLUMN     "alertAbove" DECIMAL(10,2),
ADD COLUMN     "alertBelow" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ListingDaily" ADD COLUMN     "excluded" BOOLEAN,
ADD COLUMN     "suspect" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Retailer" ADD COLUMN     "freeShippingFrom" DECIMAL(10,2),
ADD COLUMN     "shippingCost" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_chaseCardId_fkey" FOREIGN KEY ("chaseCardId") REFERENCES "ChaseCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;


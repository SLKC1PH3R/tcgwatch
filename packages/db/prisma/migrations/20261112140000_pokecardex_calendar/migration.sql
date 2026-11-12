-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'DECK';

-- AlterEnum
ALTER TYPE "ReleaseSource" ADD VALUE 'POKECARDEX';

-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "msrp" DECIMAL(10,2);

-- CreateIndex
CREATE UNIQUE INDEX "Release_externalId_key" ON "Release"("externalId");

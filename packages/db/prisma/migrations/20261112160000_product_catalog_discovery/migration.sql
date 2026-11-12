-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "discovered" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Product_externalId_key" ON "Product"("externalId");

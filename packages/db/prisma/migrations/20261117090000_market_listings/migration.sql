-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'MARKET_DEAL';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "cardmarketName" TEXT,
ADD COLUMN     "marketQuery" TEXT;

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "shipping" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "condition" TEXT,
    "location" TEXT,
    "localPickup" BOOLEAN NOT NULL DEFAULT false,
    "auction" BOOLEAN NOT NULL DEFAULT false,
    "listedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketListing_productId_firstSeenAt_idx" ON "MarketListing"("productId", "firstSeenAt");

-- CreateIndex
CREATE INDEX "MarketListing_firstSeenAt_idx" ON "MarketListing"("firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_source_externalId_productId_key" ON "MarketListing"("source", "externalId", "productId");

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

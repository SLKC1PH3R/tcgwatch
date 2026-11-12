-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('ETB', 'DISPLAY', 'TRIPACK', 'BOOSTER', 'BLISTER', 'COFFRET', 'UPC', 'MINI_TIN', 'POKEBOX', 'AUTRE');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('AUTO', 'VALIDATED');

-- CreateEnum
CREATE TYPE "ReleaseSource" AS ENUM ('TCGDEX', 'RETAILER', 'MANUAL', 'SEED');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ListingState" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR', 'BLOCKED_BY_ROBOTS');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('BACK_IN_STOCK', 'PREORDER_OPEN', 'PRICE_TARGET', 'RELEASE_DATE');

-- CreateEnum
CREATE TYPE "SealCondition" AS ENUM ('MINT', 'NEAR_MINT', 'DAMAGED', 'OPENED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "setCode" TEXT,
    "tcgdexId" TEXT,
    "serie" TEXT,
    "releaseDate" DATE,
    "productType" "ProductType",
    "imageUrl" TEXT,
    "source" "ReleaseSource" NOT NULL DEFAULT 'MANUAL',
    "sourceUrl" TEXT,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'AUTO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "ean" TEXT,
    "imageUrl" TEXT,
    "msrp" DECIMAL(10,2),
    "targetPrice" DECIMAL(10,2),
    "releaseDate" DATE,
    "releaseDateSource" "ReleaseSource",
    "notes" TEXT,
    "releaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retailer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "minDelayMs" INTEGER NOT NULL DEFAULT 3000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "stockAlertUrl" TEXT,
    "targetPrice" DECIMAL(10,2),
    "checkIntervalMin" INTEGER NOT NULL DEFAULT 30,
    "state" "ListingState" NOT NULL DEFAULT 'ACTIVE',
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "lastTitle" TEXT,
    "lastPrice" DECIMAL(10,2),
    "lastCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "lastAvailability" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "lastInStockAt" TIMESTAMP(3),
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "availability" "Availability" NOT NULL,
    "releaseDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "productId" TEXT NOT NULL,
    "listingId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "url" TEXT,
    "price" DECIMAL(10,2),
    "dedupeKey" TEXT NOT NULL,
    "sentNtfy" BOOLEAN NOT NULL DEFAULT false,
    "sentTelegram" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChaseCard" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "tcgdexId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaseCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPrice" (
    "id" TEXT NOT NULL,
    "chaseCardId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "date" DATE NOT NULL,

    CONSTRAINT "CardPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchasePrice" DECIMAL(10,2) NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "store" TEXT,
    "condition" "SealCondition" NOT NULL DEFAULT 'MINT',
    "photoPath" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_tcgdexId_key" ON "Release"("tcgdexId");

-- CreateIndex
CREATE INDEX "Release_releaseDate_idx" ON "Release"("releaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_ean_key" ON "Product"("ean");

-- CreateIndex
CREATE INDEX "Product_releaseId_idx" ON "Product"("releaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_slug_key" ON "Retailer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_domain_key" ON "Retailer"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_url_key" ON "Listing"("url");

-- CreateIndex
CREATE INDEX "Listing_state_nextCheckAt_idx" ON "Listing"("state", "nextCheckAt");

-- CreateIndex
CREATE INDEX "Listing_productId_idx" ON "Listing"("productId");

-- CreateIndex
CREATE INDEX "Snapshot_listingId_createdAt_idx" ON "Snapshot"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "Snapshot_createdAt_idx" ON "Snapshot"("createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_acknowledged_createdAt_idx" ON "AlertEvent"("acknowledged", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_dedupeKey_createdAt_idx" ON "AlertEvent"("dedupeKey", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_type_createdAt_idx" ON "AlertEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "MarketPrice_productId_date_idx" ON "MarketPrice"("productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_productId_source_date_key" ON "MarketPrice"("productId", "source", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ChaseCard_tcgdexId_key" ON "ChaseCard"("tcgdexId");

-- CreateIndex
CREATE UNIQUE INDEX "CardPrice_chaseCardId_source_date_key" ON "CardPrice"("chaseCardId", "source", "date");

-- CreateIndex
CREATE INDEX "CollectionItem_productId_idx" ON "CollectionItem"("productId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPrice" ADD CONSTRAINT "MarketPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaseCard" ADD CONSTRAINT "ChaseCard_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPrice" ADD CONSTRAINT "CardPrice_chaseCardId_fkey" FOREIGN KEY ("chaseCardId") REFERENCES "ChaseCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'NEW_LOW';
ALTER TYPE "AlertType" ADD VALUE 'MARKET_MOVE';

-- AlterTable
ALTER TABLE "CardPrice" ADD COLUMN     "avg30" DECIMAL(10,2),
ADD COLUMN     "avg7" DECIMAL(10,2),
ADD COLUMN     "low" DECIMAL(10,2),
ADD COLUMN     "trend" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ChaseCard" ADD COLUMN     "manual" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MarketPrice" ADD COLUMN     "listingCount" INTEGER,
ADD COLUMN     "median" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "ListingDaily" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "minPrice" DECIMAL(10,2),
    "maxPrice" DECIMAL(10,2),
    "lastPrice" DECIMAL(10,2),
    "minBuyablePrice" DECIMAL(10,2),
    "wasBuyable" BOOLEAN NOT NULL DEFAULT false,
    "lastAvailability" "Availability" NOT NULL,
    "checks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingDaily_date_idx" ON "ListingDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ListingDaily_listingId_date_key" ON "ListingDaily"("listingId", "date");

-- AddForeignKey
ALTER TABLE "ListingDaily" ADD CONSTRAINT "ListingDaily_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reprise de l'historique : un résumé par fiche et par jour (UTC) à partir des relevés existants.
INSERT INTO "ListingDaily" ("id", "listingId", "date", "minPrice", "maxPrice", "lastPrice",
  "minBuyablePrice", "wasBuyable", "lastAvailability", "checks", "updatedAt")
SELECT
  gen_random_uuid()::text,
  s."listingId",
  (s."createdAt" AT TIME ZONE 'UTC')::date,
  MIN(s."price"),
  MAX(s."price"),
  (ARRAY_AGG(s."price" ORDER BY s."createdAt" DESC))[1],
  MIN(s."price") FILTER (WHERE s."availability" IN ('IN_STOCK', 'PREORDER')),
  BOOL_OR(s."availability" IN ('IN_STOCK', 'PREORDER')),
  (ARRAY_AGG(s."availability" ORDER BY s."createdAt" DESC))[1],
  COUNT(*)::int,
  NOW()
FROM "Snapshot" s
GROUP BY s."listingId", (s."createdAt" AT TIME ZONE 'UTC')::date;

-- Cotes des cartes déjà relevées : la valeur affichée était la tendance.
UPDATE "CardPrice" SET "trend" = "price" WHERE "trend" IS NULL;

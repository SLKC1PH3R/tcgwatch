-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "extensionId" TEXT;

-- AlterTable
ALTER TABLE "Release" ADD COLUMN     "cardCountOfficial" INTEGER,
ADD COLUMN     "cardCountTotal" INTEGER,
ADD COLUMN     "cardsSyncedAt" TIMESTAMP(3),
ADD COLUMN     "serieId" TEXT,
ADD COLUMN     "symbolUrl" TEXT;

-- CreateTable
CREATE TABLE "Serie" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "order" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Serie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "number" INTEGER,
    "name" TEXT NOT NULL,
    "nameMissing" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "rarity" TEXT,
    "illustrator" TEXT,
    "category" TEXT,
    "types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dexIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "variants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceTrend" DECIMAL(10,2),
    "priceLow" DECIMAL(10,2),
    "priceAvg30" DECIMAL(10,2),
    "priceAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Card_releaseId_number_idx" ON "Card"("releaseId", "number");

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Product_extensionId_idx" ON "Product"("extensionId");

-- CreateIndex
CREATE INDEX "Release_serieId_idx" ON "Release"("serieId");

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;


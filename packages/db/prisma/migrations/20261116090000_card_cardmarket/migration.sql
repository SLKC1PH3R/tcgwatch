-- Cote Cardmarket de toutes les cartes (guide des prix) et indice quotidien du marché.
ALTER TABLE "Card" ADD COLUMN "priceAvg7" DECIMAL(10,2),
ADD COLUMN "priceAvg1" DECIMAL(10,2),
ADD COLUMN "cardmarketId" INTEGER,
ADD COLUMN "cardmarketCheckedAt" TIMESTAMP(3);

CREATE INDEX "Card_priceTrend_idx" ON "Card"("priceTrend");
CREATE INDEX "Card_cardmarketId_idx" ON "Card"("cardmarketId");

CREATE TABLE "MarketIndexSnapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "MarketIndexSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketIndexSnapshot_date_key_key" ON "MarketIndexSnapshot"("date", "key");

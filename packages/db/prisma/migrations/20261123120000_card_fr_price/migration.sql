-- Prix des cartes en français, d'après les annonces eBay (cartes possédées).
ALTER TABLE "Card" ADD COLUMN "frPrice" DECIMAL(10,2),
  ADD COLUMN "frPriceLow" DECIMAL(10,2),
  ADD COLUMN "frPriceCount" INTEGER,
  ADD COLUMN "frPriceAt" TIMESTAMP(3);

-- Historique du prix français (annonces eBay), à côté des cotes Cardmarket.
ALTER TABLE "CardPriceDaily" ADD COLUMN "frPrice" DECIMAL(10,2);
-- Point de départ : le prix français actuel des cartes déjà relevées.
INSERT INTO "CardPriceDaily" ("cardId", "date", "frPrice")
SELECT id, "frPriceAt"::date, "frPrice" FROM "Card" WHERE "frPrice" IS NOT NULL AND "frPriceAt" IS NOT NULL
ON CONFLICT ("cardId", "date") DO UPDATE SET "frPrice" = EXCLUDED."frPrice";

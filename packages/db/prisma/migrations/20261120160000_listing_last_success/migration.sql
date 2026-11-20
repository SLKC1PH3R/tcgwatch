-- État des relevés : date du dernier relevé réussi de chaque fiche.
ALTER TABLE "Listing" ADD COLUMN "lastSuccessAt" TIMESTAMP(3);
-- Fiches sans erreur en cours : leur dernier relevé était réussi.
UPDATE "Listing" SET "lastSuccessAt" = "lastCheckedAt" WHERE "consecutiveErrors" = 0;

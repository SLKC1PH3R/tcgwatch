-- Rééditions (Collection Classique) cherchées avec leur numéro d'extension par erreur : à relever.
UPDATE "Card" c SET "frPrice" = NULL, "frPriceLow" = NULL, "frPriceCount" = NULL, "frPriceAt" = NULL
FROM "Release" r
WHERE r.id = c."releaseId" AND (r."tcgdexId" IN ('30th-c', 'cel25c') OR r."nameFr" ILIKE '%classique%');

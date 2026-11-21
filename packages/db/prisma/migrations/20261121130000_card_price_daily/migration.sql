-- Historique quotidien de la cote de toutes les cartes cotées (avant : cartes suivies seulement).
CREATE TABLE "CardPriceDaily" (
    "cardId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trend" DECIMAL(10,2),
    "low" DECIMAL(10,2),
    "avg7" DECIMAL(10,2),
    "avg30" DECIMAL(10,2),
    CONSTRAINT "CardPriceDaily_pkey" PRIMARY KEY ("cardId", "date")
);
ALTER TABLE "CardPriceDaily" ADD CONSTRAINT "CardPriceDaily_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Historique déjà connu des cartes suivies : repris tel quel.
INSERT INTO "CardPriceDaily" ("cardId", "date", "trend", "low", "avg7", "avg30")
SELECT cc."tcgdexId", cp."date", COALESCE(cp."trend", cp."price"), cp."low", cp."avg7", cp."avg30"
FROM "CardPrice" cp
JOIN "ChaseCard" cc ON cc."id" = cp."chaseCardId"
JOIN "Card" c ON c."id" = cc."tcgdexId"
ON CONFLICT DO NOTHING;

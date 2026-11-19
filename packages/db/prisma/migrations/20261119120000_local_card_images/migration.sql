-- Images de cartes servies par le site (public/cards) : Mew B/G/R du 30e Anniversaire,
-- dont l'image de repli (scrydex) ne s'affiche pas.
UPDATE "Card" SET "imageUrl" = '/cards/30e-anniversaire-b.webp' WHERE "id" = '30th-B';
UPDATE "Card" SET "imageUrl" = '/cards/30e-anniversaire-g.webp' WHERE "id" = '30th-G';
UPDATE "Card" SET "imageUrl" = '/cards/30e-anniversaire-r.webp' WHERE "id" = '30th-R';
UPDATE "ChaseCard" SET "imageUrl" = '/cards/30e-anniversaire-b.webp' WHERE "tcgdexId" = '30th-B';
UPDATE "ChaseCard" SET "imageUrl" = '/cards/30e-anniversaire-g.webp' WHERE "tcgdexId" = '30th-G';
UPDATE "ChaseCard" SET "imageUrl" = '/cards/30e-anniversaire-r.webp' WHERE "tcgdexId" = '30th-R';

-- Scanner de cartes : empreinte perceptuelle de l'illustration de chaque carte.
ALTER TABLE "Card" ADD COLUMN "imageHash" TEXT,
ADD COLUMN "imageHashUrl" TEXT;

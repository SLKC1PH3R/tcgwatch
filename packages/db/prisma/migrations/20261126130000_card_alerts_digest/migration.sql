-- Alertes sur les cartes, résumé quotidien, heures silencieuses « retenues »
ALTER TYPE "AlertType" ADD VALUE 'WANTED_PRICE';
ALTER TYPE "AlertType" ADD VALUE 'CARD_RISE';
ALTER TABLE "AlertSettings" ADD COLUMN "quietMode" TEXT NOT NULL DEFAULT 'silent',
ADD COLUMN "digest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "digestHour" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN "digestOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "digestSentAt" TIMESTAMP(3),
ADD COLUMN "cardRisePercent" INTEGER;
ALTER TABLE "AlertEvent" ADD COLUMN "held" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShowcaseCard" ADD COLUMN "targetPrice" DECIMAL(10,2);

-- Centre d'alertes : réglages (heures silencieuses, types coupés), sourdine par produit,
-- et trace des alertes envoyées sans son ou coupées.
CREATE TABLE "AlertSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "quietStart" INTEGER,
    "quietEnd" INTEGER,
    "mutedTypes" "AlertType"[] DEFAULT ARRAY[]::"AlertType"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN "mutedAlerts" "AlertType"[] DEFAULT ARRAY[]::"AlertType"[];

ALTER TABLE "AlertEvent" ADD COLUMN "silent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "muted" BOOLEAN NOT NULL DEFAULT false;

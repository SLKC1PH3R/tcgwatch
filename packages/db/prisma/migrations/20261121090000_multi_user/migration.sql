-- Comptes multi-utilisateurs. Le premier compte créé devient administrateur et reçoit toutes
-- les données personnelles existantes (collection, cartes, classeurs, vitrines, suivis, alertes).

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "AuthTokenKind" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL,
ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER',
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
-- Comptes existants : déjà utilisés, considérés comme vérifiés ; le plus ancien est admin.
UPDATE "User" SET "emailVerifiedAt" = "createdAt";
UPDATE "User" SET "role" = 'ADMIN' WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" LIMIT 1);

CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AuthTokenKind" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthToken_userId_kind_idx" ON "AuthToken"("userId", "kind");
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Produits suivis : bon prix et alertes coupées par utilisateur.
CREATE TABLE "ProductFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetPrice" DECIMAL(10,2),
    "mutedAlerts" "AlertType"[] DEFAULT ARRAY[]::"AlertType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductFollow_userId_productId_key" ON "ProductFollow"("userId", "productId");
CREATE INDEX "ProductFollow_productId_idx" ON "ProductFollow"("productId");
ALTER TABLE "ProductFollow" ADD CONSTRAINT "ProductFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductFollow" ADD CONSTRAINT "ProductFollow_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "ProductFollow" ("id", "userId", "productId", "targetPrice", "mutedAlerts", "updatedAt")
SELECT 'pf_' || p."id", u."id", p."id", p."targetPrice", p."mutedAlerts", NOW()
FROM "Product" p
CROSS JOIN (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1) u
WHERE p."targetPrice" IS NOT NULL OR cardinality(p."mutedAlerts") > 0;
ALTER TABLE "Product" DROP COLUMN "mutedAlerts";

-- Réglages d'alertes : une ligne par utilisateur.
ALTER TABLE "AlertSettings" ADD COLUMN "userId" TEXT;
UPDATE "AlertSettings" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1);
DELETE FROM "AlertSettings" WHERE "userId" IS NULL;
ALTER TABLE "AlertSettings" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX "AlertSettings_userId_key" ON "AlertSettings"("userId");
ALTER TABLE "AlertSettings" ADD CONSTRAINT "AlertSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Données personnelles existantes : au compte administrateur.
ALTER TABLE "AlertEvent" ADD COLUMN "userId" TEXT;
ALTER TABLE "CollectionItem" ADD COLUMN "userId" TEXT;
ALTER TABLE "OwnedCard" ADD COLUMN "userId" TEXT;
ALTER TABLE "CardBinder" ADD COLUMN "userId" TEXT;
ALTER TABLE "Showcase" ADD COLUMN "userId" TEXT;
UPDATE "AlertEvent" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1);
UPDATE "CollectionItem" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1);
UPDATE "OwnedCard" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1);
UPDATE "CardBinder" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1);
UPDATE "Showcase" SET "userId" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1);
-- Sans compte (base vide), rien à rattacher : lignes orphelines supprimées.
DELETE FROM "AlertEvent" WHERE "userId" IS NULL;
DELETE FROM "CollectionItem" WHERE "userId" IS NULL;
DELETE FROM "OwnedCard" WHERE "userId" IS NULL;
DELETE FROM "CardBinder" WHERE "userId" IS NULL;
DELETE FROM "Showcase" WHERE "userId" IS NULL;
ALTER TABLE "AlertEvent" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "CollectionItem" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "OwnedCard" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "CardBinder" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Showcase" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnedCard" ADD CONSTRAINT "OwnedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardBinder" ADD CONSTRAINT "CardBinder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Showcase" ADD CONSTRAINT "Showcase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "AlertEvent_acknowledged_createdAt_idx";
CREATE INDEX "AlertEvent_userId_acknowledged_createdAt_idx" ON "AlertEvent"("userId", "acknowledged", "createdAt");
CREATE INDEX "CollectionItem_userId_idx" ON "CollectionItem"("userId");
DROP INDEX "OwnedCard_cardId_variant_key";
DROP INDEX "OwnedCard_createdAt_idx";
CREATE UNIQUE INDEX "OwnedCard_userId_cardId_variant_key" ON "OwnedCard"("userId", "cardId", "variant");
CREATE INDEX "OwnedCard_userId_createdAt_idx" ON "OwnedCard"("userId", "createdAt");
CREATE INDEX "CardBinder_userId_idx" ON "CardBinder"("userId");
CREATE INDEX "Showcase_userId_idx" ON "Showcase"("userId");

-- Produits ouverts et cartes tirées (rentabilité d'un display, d'un ETB…).
CREATE TABLE "ProductOpening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "openedAt" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductOpening_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OpeningCard" (
    "id" TEXT NOT NULL,
    "openingId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'normal',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "OpeningCard_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductOpening_userId_idx" ON "ProductOpening"("userId");
CREATE INDEX "ProductOpening_productId_idx" ON "ProductOpening"("productId");
CREATE UNIQUE INDEX "OpeningCard_openingId_cardId_variant_key" ON "OpeningCard"("openingId", "cardId", "variant");
CREATE INDEX "OpeningCard_cardId_idx" ON "OpeningCard"("cardId");
ALTER TABLE "ProductOpening" ADD CONSTRAINT "ProductOpening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOpening" ADD CONSTRAINT "ProductOpening_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpeningCard" ADD CONSTRAINT "OpeningCard_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "ProductOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpeningCard" ADD CONSTRAINT "OpeningCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

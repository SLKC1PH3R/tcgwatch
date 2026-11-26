-- Reventes de cartes à l'unité
CREATE TABLE "CardSale" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'normal',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "saleFees" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "saleChannel" TEXT,
    "soldAt" DATE NOT NULL,
    "unitCost" DECIMAL(10,2),
    "purchasedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardSale_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CardSale_userId_soldAt_idx" ON "CardSale"("userId", "soldAt");
ALTER TABLE "CardSale" ADD CONSTRAINT "CardSale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardSale" ADD CONSTRAINT "CardSale_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

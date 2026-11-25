-- Prix d'achat des cartes : date d'achat à l'unité et lots couvrant des extensions.
ALTER TABLE "OwnedCard" ADD COLUMN "purchasedAt" DATE;
CREATE TABLE "CardLot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "purchasedAt" DATE NOT NULL,
    "releases" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CardLot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CardLot_userId_idx" ON "CardLot"("userId");
ALTER TABLE "CardLot" ADD CONSTRAINT "CardLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

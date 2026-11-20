-- Marché de l'occasion : médiane quotidienne des annonces eBay par produit.
CREATE TABLE "SecondhandDaily" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "median" DECIMAL(10,2) NOT NULL,
    "low" DECIMAL(10,2) NOT NULL,
    "count" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecondhandDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecondhandDaily_productId_source_date_key" ON "SecondhandDaily"("productId", "source", "date");

ALTER TABLE "SecondhandDaily" ADD CONSTRAINT "SecondhandDaily_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

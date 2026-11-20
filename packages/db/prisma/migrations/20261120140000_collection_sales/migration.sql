-- Rentabilité de la collection : frais de port à l'achat et revente (date, prix, frais, canal).
ALTER TABLE "CollectionItem" ADD COLUMN "shipping" DECIMAL(10,2),
ADD COLUMN "soldAt" DATE,
ADD COLUMN "salePrice" DECIMAL(10,2),
ADD COLUMN "saleFees" DECIMAL(10,2),
ADD COLUMN "saleChannel" TEXT;

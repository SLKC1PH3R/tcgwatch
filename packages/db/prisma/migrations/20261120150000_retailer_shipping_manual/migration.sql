-- Frais de port d'une boutique saisis sur le site : prioritaires sur l'annuaire.
ALTER TABLE "Retailer" ADD COLUMN "shippingManual" BOOLEAN NOT NULL DEFAULT false;

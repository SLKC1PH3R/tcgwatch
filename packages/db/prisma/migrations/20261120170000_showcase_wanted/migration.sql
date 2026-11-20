-- Vitrine « cartes que je cherche » (liste de recherche partageable).
ALTER TABLE "Showcase" ADD COLUMN "wanted" BOOLEAN NOT NULL DEFAULT false;

-- Nom anglais et sigle officiel des extensions (import de collections exportées en anglais).
ALTER TABLE "Release" ADD COLUMN "nameEn" TEXT, ADD COLUMN "abbreviation" TEXT;

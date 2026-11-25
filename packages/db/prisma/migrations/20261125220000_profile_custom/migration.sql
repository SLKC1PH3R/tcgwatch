-- Personnalisation de la page de collectionneur
ALTER TABLE "User" ADD COLUMN "profileAvatarCardId" TEXT,
ADD COLUMN "profileAccent" TEXT,
ADD COLUMN "profileFavorite" TEXT,
ADD COLUMN "profileLocation" TEXT,
ADD COLUMN "profileContact" TEXT,
ADD COLUMN "profileFeaturedId" TEXT,
ADD COLUMN "profileShowcases" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "profileWanted" BOOLEAN NOT NULL DEFAULT true;

-- Page publique de collectionneur
ALTER TABLE "User" ADD COLUMN "profilePublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "profileSlug" TEXT,
ADD COLUMN "profileName" TEXT,
ADD COLUMN "profileBio" TEXT,
ADD COLUMN "profileBinders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "profileDoubles" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "profilePrices" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_profileSlug_key" ON "User"("profileSlug");

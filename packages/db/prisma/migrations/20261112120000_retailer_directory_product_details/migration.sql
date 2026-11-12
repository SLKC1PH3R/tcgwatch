-- CreateEnum
CREATE TYPE "RetailerKind" AS ENUM ('SPECIALIST', 'CULTURE', 'TOYS', 'SUPERMARKET', 'OTHER');

-- CreateEnum
CREATE TYPE "RetailerAccess" AS ENUM ('OK', 'BROWSER', 'LIMITED', 'UNTESTED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Retailer" ADD COLUMN     "access" "RetailerAccess" NOT NULL DEFAULT 'UNTESTED',
ADD COLUMN     "kind" "RetailerKind" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pokemonUrl" TEXT,
ADD COLUMN     "searchUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "category" TEXT,
ADD COLUMN     "lastImageUrl" TEXT,
ADD COLUMN     "sku" TEXT;

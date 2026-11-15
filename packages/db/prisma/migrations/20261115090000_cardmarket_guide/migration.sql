-- AlterTable
ALTER TABLE "MarketPrice" ADD COLUMN     "avg1" DECIMAL(10,2),
ADD COLUMN     "avg30" DECIMAL(10,2),
ADD COLUMN     "avg7" DECIMAL(10,2),
ADD COLUMN     "low" DECIMAL(10,2),
ADD COLUMN     "trend" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "cardmarketId" INTEGER;


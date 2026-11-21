-- Signalements d'erreurs (prix, stock, rapprochement) par les utilisateurs.
CREATE TYPE "ReportKind" AS ENUM ('PRICE', 'STOCK', 'MATCH', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

CREATE TABLE "ErrorReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "productId" TEXT,
    "listingId" TEXT,
    "cardId" TEXT,
    "path" TEXT,
    "message" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ErrorReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ErrorReport_status_createdAt_idx" ON "ErrorReport"("status", "createdAt");
ALTER TABLE "ErrorReport" ADD CONSTRAINT "ErrorReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

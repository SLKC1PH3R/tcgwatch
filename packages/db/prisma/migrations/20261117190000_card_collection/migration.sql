-- CreateTable
CREATE TABLE "OwnedCard" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'normal',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchasePrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnedCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardBinder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "releaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardBinder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinderCard" (
    "id" TEXT NOT NULL,
    "binderId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BinderCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Showcase" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "showPrices" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Showcase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowcaseCard" (
    "id" TEXT NOT NULL,
    "showcaseId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShowcaseCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnedCard_createdAt_idx" ON "OwnedCard"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnedCard_cardId_variant_key" ON "OwnedCard"("cardId", "variant");

-- CreateIndex
CREATE INDEX "BinderCard_binderId_position_idx" ON "BinderCard"("binderId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BinderCard_binderId_cardId_key" ON "BinderCard"("binderId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Showcase_slug_key" ON "Showcase"("slug");

-- CreateIndex
CREATE INDEX "ShowcaseCard_showcaseId_position_idx" ON "ShowcaseCard"("showcaseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ShowcaseCard_showcaseId_cardId_key" ON "ShowcaseCard"("showcaseId", "cardId");

-- AddForeignKey
ALTER TABLE "OwnedCard" ADD CONSTRAINT "OwnedCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardBinder" ADD CONSTRAINT "CardBinder_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinderCard" ADD CONSTRAINT "BinderCard_binderId_fkey" FOREIGN KEY ("binderId") REFERENCES "CardBinder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinderCard" ADD CONSTRAINT "BinderCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowcaseCard" ADD CONSTRAINT "ShowcaseCard_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "Showcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowcaseCard" ADD CONSTRAINT "ShowcaseCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

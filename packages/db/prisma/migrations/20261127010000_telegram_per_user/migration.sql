-- Telegram par utilisateur et réglages globaux
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT,
ADD COLUMN "telegramName" TEXT,
ADD COLUMN "telegramLinkToken" TEXT,
ADD COLUMN "telegramLinkExpires" TIMESTAMP(3),
ADD COLUMN "telegramEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "telegramAdminMode" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "telegramPausedUntil" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");
CREATE UNIQUE INDEX "User_telegramLinkToken_key" ON "User"("telegramLinkToken");

CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

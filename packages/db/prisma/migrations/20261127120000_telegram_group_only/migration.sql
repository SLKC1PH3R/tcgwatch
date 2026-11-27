-- Retour au groupe Telegram unique : plus de Telegram par utilisateur
DROP INDEX IF EXISTS "User_telegramChatId_key";
DROP INDEX IF EXISTS "User_telegramLinkToken_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "telegramChatId",
DROP COLUMN IF EXISTS "telegramName",
DROP COLUMN IF EXISTS "telegramLinkToken",
DROP COLUMN IF EXISTS "telegramLinkExpires",
DROP COLUMN IF EXISTS "telegramEnabled",
DROP COLUMN IF EXISTS "telegramAdminMode",
DROP COLUMN IF EXISTS "telegramPausedUntil";
DELETE FROM "AppSetting" WHERE "key" IN ('telegram.botUsername', 'telegram.updateOffset');

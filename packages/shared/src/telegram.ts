/** Réglage administrateur du Telegram d'un utilisateur. */
export type TelegramAdminMode = 'active' | 'silent' | 'off';

export const TELEGRAM_ADMIN_MODES: Record<TelegramAdminMode, string> = {
  active: 'Actif',
  silent: 'Sans son',
  off: 'Coupé',
};

/** Clés des réglages globaux (AppSetting) liés à Telegram. */
export const TELEGRAM_SETTINGS = {
  /** Pause de tout Telegram jusqu'à cette date (ISO). */
  pausedUntil: 'telegram.pausedUntil',
  /** Nom du bot (@…), relevé par le worker, pour le lien de liaison. */
  botUsername: 'telegram.botUsername',
  /** Curseur de lecture des messages reçus par le bot (getUpdates). */
  updateOffset: 'telegram.updateOffset',
} as const;

export function parseTelegramMode(v: string | null | undefined): TelegramAdminMode {
  return v === 'silent' || v === 'off' ? v : 'active';
}

export type TelegramDecision =
  | { send: true; silent: boolean }
  | { send: false; reason: 'unlinked' | 'disabled' | 'off' | 'paused' | 'global' };

/**
 * Faut-il envoyer une alerte sur le Telegram personnel d'un utilisateur, et avec du son ?
 * Pause globale, puis réglage administrateur (coupé, pause, sans son), puis choix de
 * l'utilisateur.
 */
export function telegramDecision(
  user: {
    telegramChatId: string | null;
    telegramEnabled: boolean;
    telegramAdminMode: string;
    telegramPausedUntil: Date | null;
  },
  globalPausedUntil: Date | null,
  now: Date = new Date(),
): TelegramDecision {
  if (!user.telegramChatId) return { send: false, reason: 'unlinked' };
  if (globalPausedUntil && globalPausedUntil > now) return { send: false, reason: 'global' };
  const mode = parseTelegramMode(user.telegramAdminMode);
  if (mode === 'off') return { send: false, reason: 'off' };
  if (user.telegramPausedUntil && user.telegramPausedUntil > now) {
    return { send: false, reason: 'paused' };
  }
  if (!user.telegramEnabled) return { send: false, reason: 'disabled' };
  return { send: true, silent: mode === 'silent' };
}

/** Date d'une pause globale enregistrée (ISO), ou null si absente ou illisible. */
export function parsePausedUntil(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Clés des réglages globaux (AppSetting) liés à Telegram. */
export const TELEGRAM_SETTINGS = {
  /** Pause du bot (groupe Telegram) jusqu'à cette date (ISO). */
  pausedUntil: 'telegram.pausedUntil',
  /** Lien d'invitation du groupe Telegram, affiché dans la page Alertes. */
  inviteUrl: 'telegram.inviteUrl',
} as const;

/** Date d'une pause enregistrée (ISO), ou null si absente ou illisible. */
export function parsePausedUntil(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Lien d'invitation Telegram valide (https://t.me/…), sinon null. */
export function parseTelegramInvite(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v && /^https:\/\/(t\.me|telegram\.me)\/\S+$/.test(v) ? v : null;
}

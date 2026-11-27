/** Clés des réglages globaux (AppSetting) liés à Telegram. */
export const TELEGRAM_SETTINGS = {
  /** Pause du bot (groupe Telegram) jusqu'à cette date (ISO). */
  pausedUntil: 'telegram.pausedUntil',
  /** Lien d'invitation du groupe Telegram, affiché dans la page Alertes. */
  inviteUrl: 'telegram.inviteUrl',
  /** Test demandé depuis la page Membres (ISO) : le worker l'envoie dans la minute. */
  testRequestedAt: 'notify.testRequestedAt',
  /** Résultat du dernier test : { at, ntfy, telegram } en JSON. */
  testResult: 'notify.testResult',
} as const;

export interface NotifyTestResult {
  at: string;
  ntfy: boolean;
  telegram: boolean;
  /** Bot en pause : Telegram non essayé. */
  paused?: boolean;
}

export function parseNotifyTestResult(value: string | null | undefined): NotifyTestResult | null {
  if (!value) return null;
  try {
    const r = JSON.parse(value) as NotifyTestResult;
    return typeof r.at === 'string' ? r : null;
  } catch {
    return null;
  }
}

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

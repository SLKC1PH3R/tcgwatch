import type { Logger } from '@tcgwatch/shared/logger';

export interface Notification {
  title: string;
  message: string;
  /** Lien ouvert au clic (fiche produit). */
  url?: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
  tags?: string[];
}

export interface NotifierConfig {
  ntfyUrl?: string;
  ntfyToken?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface DeliveryResult {
  ntfy: boolean;
  telegram: boolean;
}

const PRIORITY: Record<NonNullable<Notification['priority']>, string> = {
  min: '1',
  low: '2',
  default: '3',
  high: '4',
  urgent: '5',
};

/** En-têtes HTTP : ntfy n'accepte que l'ASCII, on encode en RFC 2047 si besoin. */
function headerSafe(value: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7f]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export class Notifier {
  constructor(
    private readonly config: NotifierConfig,
    private readonly logger: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get enabled() {
    return { ntfy: Boolean(this.config.ntfyUrl), telegram: this.telegramEnabled };
  }

  private get telegramEnabled() {
    return Boolean(this.config.telegramBotToken && this.config.telegramChatId);
  }

  async send(n: Notification): Promise<DeliveryResult> {
    const [ntfy, telegram] = await Promise.all([this.sendNtfy(n), this.sendTelegram(n)]);
    return { ntfy, telegram };
  }

  private async sendNtfy(n: Notification): Promise<boolean> {
    if (!this.config.ntfyUrl) return false;
    const headers: Record<string, string> = {
      Title: headerSafe(n.title),
      Priority: PRIORITY[n.priority ?? 'default'],
      'Content-Type': 'text/plain; charset=utf-8',
    };
    if (n.tags?.length) headers.Tags = n.tags.join(',');
    if (n.url) {
      headers.Click = n.url;
      headers.Actions = `view, ${headerSafe('Voir la fiche')}, ${n.url}`;
    }
    if (this.config.ntfyToken) headers.Authorization = `Bearer ${this.config.ntfyToken}`;
    try {
      const res = await this.fetchImpl(this.config.ntfyUrl, {
        method: 'POST',
        headers,
        body: n.message,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err) {
      this.logger.error({ err, channel: 'ntfy' }, 'Échec d’envoi de la notification');
      return false;
    }
  }

  private async sendTelegram(n: Notification): Promise<boolean> {
    if (!this.telegramEnabled) return false;
    const escape = (s: string) =>
      s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    const text = [
      `<b>${escape(n.title)}</b>`,
      escape(n.message),
      n.url ? `<a href="${n.url}">Voir la fiche</a>` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      const res = await this.fetchImpl(
        `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.config.telegramChatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err) {
      this.logger.error(
        { err: String(err), channel: 'telegram' },
        'Échec d’envoi de la notification',
      );
      return false;
    }
  }
}

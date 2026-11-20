import type { Logger } from '@tcgwatch/shared/logger';

export interface Notification {
  title: string;
  message: string;
  /** Lien ouvert au clic (fiche produit). */
  url?: string;
  /** Repères de prix affichés sous le message (« Prix conseillé : 29,99 € »…). */
  details?: string[];
  /** Texte du lien sur Telegram (« Voir la fiche » par défaut). */
  linkLabel?: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
  tags?: string[];
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
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
        body: [n.message, ...(n.details ?? [])].join('\n'),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (err) {
      this.logger.error({ err, channel: 'ntfy' }, 'Échec d’envoi de la notification');
      return false;
    }
  }

  /**
   * Conversations récentes du bot (Telegram getUpdates) : retrouver l'identifiant du chat
   * après avoir écrit au bot. Ne marche que si le bot n'a pas de webhook.
   */
  async telegramChats(): Promise<{ id: string; name: string; type: string }[]> {
    if (!this.config.telegramBotToken) return [];
    const res = await this.fetchImpl(
      `https://api.telegram.org/bot${this.config.telegramBotToken}/getUpdates`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`Telegram getUpdates : HTTP ${res.status}`);
    const data = (await res.json()) as {
      result?: {
        message?: { chat?: TelegramChat };
        channel_post?: { chat?: TelegramChat };
        my_chat_member?: { chat?: TelegramChat };
      }[];
    };
    const chats = new Map<string, { id: string; name: string; type: string }>();
    for (const u of data.result ?? []) {
      const chat = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
      if (!chat) continue;
      const name =
        chat.title ?? ([chat.first_name, chat.last_name].filter(Boolean).join(' ') || '?');
      chats.set(String(chat.id), { id: String(chat.id), name, type: chat.type });
    }
    return [...chats.values()];
  }

  private async sendTelegram(n: Notification): Promise<boolean> {
    if (!this.telegramEnabled) return false;
    const escape = (s: string) =>
      s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const text = [
      `<b>${escape(n.title)}</b>`,
      escape(n.message),
      ...(n.details ?? []).map((d) => {
        const i = d.indexOf(' : ');
        if (i < 0) return escape(d);
        // Valeur en gras, précisions (source, écart) en texte normal.
        const value = d.slice(i + 3);
        const cut = value.search(/ · | \(/);
        const main = cut < 0 ? value : value.slice(0, cut);
        const rest = cut < 0 ? '' : value.slice(cut);
        return `${escape(d.slice(0, i))} : <b>${escape(main)}</b>${escape(rest)}`;
      }),
      n.url ? `<a href="${escape(n.url)}">${escape(n.linkLabel ?? 'Voir la fiche')}</a>` : '',
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

import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { Notifier } from '../src/notify';

const logger = pino({ level: 'silent' });

function capture() {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe('Notifier', () => {
  it('n’envoie rien sans configuration', async () => {
    const { calls, fetchImpl } = capture();
    const n = new Notifier({}, logger, fetchImpl);
    await expect(n.send({ title: 't', message: 'm' })).resolves.toEqual({
      ntfy: false,
      telegram: false,
    });
    expect(calls).toHaveLength(0);
  });

  it('publie sur ntfy avec titre encodé, priorité et lien', async () => {
    const { calls, fetchImpl } = capture();
    const n = new Notifier(
      { ntfyUrl: 'https://ntfy.sh/mon-topic', ntfyToken: 'tk' },
      logger,
      fetchImpl,
    );
    const r = await n.send({
      title: '✅ Retour en stock : ETB Règne Delta',
      message: 'Play-In — 59,90 €',
      url: 'https://www.play-in.com/fr/produit/1',
      priority: 'high',
      tags: ['white_check_mark'],
    });
    expect(r.ntfy).toBe(true);
    const { url, init } = calls[0]!;
    const headers = init.headers as Record<string, string>;
    expect(url).toBe('https://ntfy.sh/mon-topic');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('Play-In — 59,90 €');
    expect(headers.Priority).toBe('4');
    expect(headers.Click).toBe('https://www.play-in.com/fr/produit/1');
    expect(headers.Authorization).toBe('Bearer tk');
    expect(headers.Title).toMatch(/^=\?UTF-8\?B\?/);
    const decoded = Buffer.from(headers.Title!.slice(10, -2), 'base64').toString('utf8');
    expect(decoded).toBe('✅ Retour en stock : ETB Règne Delta');
  });

  it('envoie aussi sur Telegram si configuré', async () => {
    const { calls, fetchImpl } = capture();
    const n = new Notifier(
      { telegramBotToken: '123:abc', telegramChatId: '42' },
      logger,
      fetchImpl,
    );
    const r = await n.send({ title: 'Prix <cible>', message: 'ok' });
    expect(r).toEqual({ ntfy: false, telegram: true });
    expect(calls[0]!.url).toBe('https://api.telegram.org/bot123:abc/sendMessage');
    const body = JSON.parse(String(calls[0]!.init.body)) as { chat_id: string; text: string };
    expect(body.chat_id).toBe('42');
    expect(body.text).toContain('<b>Prix &lt;cible&gt;</b>');
  });

  it('échappe le lien des messages Telegram', async () => {
    const { calls, fetchImpl } = capture();
    const n = new Notifier(
      { telegramBotToken: '123:abc', telegramChatId: '42' },
      logger,
      fetchImpl,
    );
    await n.send({ title: 't', message: 'm', url: 'https://www.ebay.fr/sch/i.html?a=1&b=2' });
    const body = JSON.parse(String(calls[0]!.init.body)) as { text: string };
    expect(body.text).toContain('<a href="https://www.ebay.fr/sch/i.html?a=1&amp;b=2">');
  });

  it('renvoie false si ntfy répond en erreur', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('', { status: 500 }),
    ) as unknown as typeof fetch;
    const n = new Notifier({ ntfyUrl: 'https://ntfy.sh/x' }, logger, fetchImpl);
    await expect(n.send({ title: 't', message: 'm' })).resolves.toEqual({
      ntfy: false,
      telegram: false,
    });
  });
});

describe('Notifier — repères de prix', () => {
  it('ajoute prix conseillé et marché secondaire sous le message Telegram', async () => {
    const { calls, fetchImpl } = capture();
    const n = new Notifier({ telegramBotToken: 'bt', telegramChatId: '42' }, logger, fetchImpl);
    await n.send({
      title: '✅ Retour en stock : Lucario',
      message: 'DracauGames — 34,90 €',
      details: [
        'Prix de vente conseillé : 29,99 €',
        'Marché secondaire : 42,00 € · Cardmarket (+40 % vs conseillé)',
      ],
      url: 'https://example.com/p',
    });
    const body = JSON.parse(String(calls[0]!.init.body)) as { text: string };
    expect(body.text).toBe(
      [
        '<b>✅ Retour en stock : Lucario</b>',
        'DracauGames — 34,90 €',
        'Prix de vente conseillé : <b>29,99 €</b>',
        'Marché secondaire : <b>42,00 €</b> · Cardmarket (+40 % vs conseillé)',
        '<a href="https://example.com/p">Voir la fiche</a>',
      ].join('\n'),
    );
  });
});

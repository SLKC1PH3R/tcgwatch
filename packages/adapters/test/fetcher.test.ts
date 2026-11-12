import { describe, expect, it, vi } from 'vitest';
import { AdapterError, PoliteFetcher } from '../src';

const html = (body: string, status = 200) =>
  new Response(`<html><body>${body}</body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

function fakeFetch(handler: (url: string) => Response | Promise<Response>) {
  return vi.fn(async (input: string | URL | Request) =>
    handler(String(input)),
  ) as unknown as typeof fetch;
}

const baseOpts = { userAgent: 'TestUA', timeoutMs: 5000, minDelayMs: 0, maxDelayMs: 0 };

describe('PoliteFetcher', () => {
  it('respecte robots.txt', async () => {
    const fetchImpl = fakeFetch((url) =>
      url.endsWith('/robots.txt') ? new Response('User-agent: *\nDisallow: /prive/') : html('ok'),
    );
    const f = new PoliteFetcher({ ...baseOpts, fetchImpl });
    await expect(f.fetchHtml('https://shop.example/public/1')).resolves.toContain('ok');
    await expect(f.fetchHtml('https://shop.example/prive/1')).rejects.toMatchObject({
      code: 'ROBOTS',
    });
  });

  it('autorise tout si robots.txt est absent', async () => {
    const fetchImpl = fakeFetch((url) =>
      url.endsWith('/robots.txt') ? new Response('', { status: 404 }) : html('ok'),
    );
    const f = new PoliteFetcher({ ...baseOpts, fetchImpl });
    await expect(f.fetchHtml('https://shop.example/x')).resolves.toContain('ok');
  });

  it('sérialise les requêtes d’un même domaine', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchImpl = fakeFetch(async (url) => {
      if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return html('ok');
    });
    const f = new PoliteFetcher({ ...baseOpts, fetchImpl });
    await Promise.all([1, 2, 3].map((i) => f.fetchHtml(`https://shop.example/p/${i}`)));
    expect(maxInFlight).toBe(1);
  });

  it('signale un blocage anti-bot (403)', async () => {
    const fetchImpl = fakeFetch((url) =>
      url.endsWith('/robots.txt') ? new Response('', { status: 404 }) : html('Forbidden', 403),
    );
    const f = new PoliteFetcher({ ...baseOpts, fetchImpl });
    const err = await f.fetchHtml('https://shop.example/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).code).toBe('BLOCKED');
  });

  it('se replie sur le navigateur si le site bloque le HTTP simple', async () => {
    const fetchImpl = fakeFetch((url) =>
      url.endsWith('/robots.txt')
        ? new Response('', { status: 404 })
        : html('<script src="/_Incapsula_Resource?x=1"></script>'),
    );
    const render = vi.fn(async () => '<html><body>rendu chromium</body></html>');
    const f = new PoliteFetcher({
      ...baseOpts,
      fetchImpl,
      browser: { render, close: async () => {} },
    });
    await expect(f.fetchHtml('https://shop.example/x')).resolves.toContain('rendu chromium');
    expect(render).toHaveBeenCalledOnce();
  });

  it('décode une page ISO-8859-1', async () => {
    const bytes = new Uint8Array([
      0x3c, 0x70, 0x3e, 0x52, 0xe8, 0x67, 0x6e, 0x65, 0x3c, 0x2f, 0x70, 0x3e,
    ]); // <p>Règne</p>
    const fetchImpl = fakeFetch((url) =>
      url.endsWith('/robots.txt')
        ? new Response('', { status: 404 })
        : new Response(bytes, { headers: { 'content-type': 'text/html; charset=iso-8859-1' } }),
    );
    const f = new PoliteFetcher({ ...baseOpts, fetchImpl });
    await expect(f.fetchHtml('https://shop.example/x')).resolves.toBe('<p>Règne</p>');
  });
});

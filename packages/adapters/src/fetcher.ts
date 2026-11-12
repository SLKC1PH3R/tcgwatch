import { RobotsChecker } from './robots';
import { AdapterError, type FetchContext, type FetchOptions } from './types';

export interface BrowserRenderer {
  render(url: string, options: { userAgent: string; timeoutMs: number }): Promise<string>;
  close(): Promise<void>;
}

export interface PoliteFetcherOptions {
  userAgent: string;
  timeoutMs: number;
  /** Délai aléatoire minimal/maximal entre deux requêtes vers un même domaine. */
  minDelayMs: number;
  maxDelayMs: number;
  /** Rendu Chromium optionnel pour les sites en JavaScript / protégés. */
  browser?: BrowserRenderer;
  respectRobots?: boolean;
  fetchImpl?: typeof fetch;
  onRequest?: (info: { url: string; via: 'http' | 'browser'; waitedMs: number }) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Signatures de pages de défi anti-bot. */
const CHALLENGE_MARKERS = [
  '_Incapsula_Resource',
  'cf-browser-verification',
  'challenge-platform',
  'cf_chl_',
  'captcha-delivery.com',
  'Attention Required! | Cloudflare',
];

export function looksLikeChallenge(html: string): boolean {
  return html.length < 20_000 && CHALLENGE_MARKERS.some((m) => html.includes(m));
}

/** Décode le corps selon le charset annoncé (en-tête puis balise meta), UTF-8 par défaut. */
async function decodeBody(res: Response): Promise<string> {
  const buf = new Uint8Array(await res.arrayBuffer());
  const header = res.headers.get('content-type') ?? '';
  let charset = header.match(/charset=([\w-]+)/i)?.[1];
  if (!charset) {
    const head = new TextDecoder('latin1').decode(buf.subarray(0, 4096));
    charset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  }
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

/**
 * Client HTTP « poli » :
 * - une seule requête à la fois par domaine (file d'attente par domaine),
 * - délai aléatoire entre deux requêtes d'un même domaine,
 * - user-agent réaliste, timeout, respect de robots.txt,
 * - détection des pages de défi anti-bot et repli éventuel sur Chromium.
 */
export class PoliteFetcher implements FetchContext {
  private queues = new Map<string, Promise<unknown>>();
  private lastRequestAt = new Map<string, number>();
  private robots: RobotsChecker;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: PoliteFetcherOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.robots = new RobotsChecker(opts.userAgent, this.fetchImpl);
  }

  fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
    const domain = new URL(url).hostname;
    const previous = this.queues.get(domain) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(() => this.run(url, domain, options));
    this.queues.set(domain, task);
    // Nettoyage pour ne pas garder la chaîne indéfiniment.
    void task
      .finally(() => {
        if (this.queues.get(domain) === task) this.queues.delete(domain);
      })
      .catch(() => undefined);
    return task;
  }

  private async run(url: string, domain: string, options: FetchOptions): Promise<string> {
    if (this.opts.respectRobots !== false && !(await this.robots.isAllowed(url))) {
      throw new AdapterError(`robots.txt interdit l'accès à ${url}`, 'ROBOTS');
    }

    const waitedMs = await this.throttle(domain, options.minDelayMs);
    const useBrowser = options.browser && this.opts.browser;
    this.opts.onRequest?.({ url, via: useBrowser ? 'browser' : 'http', waitedMs });

    try {
      if (useBrowser) return await this.render(url, domain);
      try {
        return await this.httpGet(url, domain);
      } catch (err) {
        // Repli Chromium si le site bloque les requêtes HTTP simples.
        if (err instanceof AdapterError && err.code === 'BLOCKED' && this.opts.browser) {
          return await this.render(url, domain);
        }
        throw err;
      }
    } finally {
      this.lastRequestAt.set(domain, Date.now());
    }
  }

  private async render(url: string, domain: string): Promise<string> {
    const html = await this.opts.browser!.render(url, {
      userAgent: this.opts.userAgent,
      timeoutMs: this.opts.timeoutMs,
    });
    if (looksLikeChallenge(html)) {
      throw new AdapterError(`Page de défi anti-bot sur ${domain}`, 'BLOCKED');
    }
    return html;
  }

  private async throttle(domain: string, domainMinDelayMs = 0): Promise<number> {
    const last = this.lastRequestAt.get(domain);
    if (last === undefined) return 0;
    const minDelayMs = Math.max(this.opts.minDelayMs, domainMinDelayMs);
    const maxDelayMs = Math.max(this.opts.maxDelayMs, minDelayMs);
    const delay = minDelayMs + Math.random() * Math.max(0, maxDelayMs - minDelayMs);
    const wait = Math.max(0, last + delay - Date.now());
    if (wait > 0) await sleep(wait);
    return wait;
  }

  private async httpGet(url: string, domain: string): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(this.opts.timeoutMs),
        headers: {
          'user-agent': this.opts.userAgent,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'fr-FR,fr;q=0.9,en;q=0.6',
          'cache-control': 'no-cache',
        },
      });
    } catch (err) {
      const isTimeout =
        err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new AdapterError(
        isTimeout
          ? `Délai dépassé pour ${domain}`
          : `Erreur réseau vers ${domain} : ${String(err)}`,
        isTimeout ? 'TIMEOUT' : 'HTTP',
      );
    }
    const html = await decodeBody(res);
    if (res.status === 403 || res.status === 429 || looksLikeChallenge(html)) {
      throw new AdapterError(
        `Accès refusé par ${domain} (HTTP ${res.status})`,
        'BLOCKED',
        res.status,
      );
    }
    if (!res.ok) {
      throw new AdapterError(`HTTP ${res.status} sur ${url}`, 'HTTP', res.status);
    }
    return html;
  }
}

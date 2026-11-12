import robotsParser from 'robots-parser';

type Robots = ReturnType<typeof robotsParser>;

interface CacheEntry {
  robots: Robots | null;
  fetchedAt: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Vérifie robots.txt avant chaque requête (cache 24 h par origine).
 * Si robots.txt est absent ou inaccessible, l'accès est autorisé (comportement standard).
 */
export class RobotsChecker {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async isAllowed(url: string): Promise<boolean> {
    const origin = new URL(url).origin;
    let entry = this.cache.get(origin);
    if (!entry || Date.now() - entry.fetchedAt > TTL_MS) {
      entry = { robots: await this.load(origin), fetchedAt: Date.now() };
      this.cache.set(origin, entry);
    }
    if (!entry.robots) return true;
    return entry.robots.isAllowed(url, this.userAgent) ?? true;
  }

  private async load(origin: string): Promise<Robots | null> {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const res = await this.fetchImpl(robotsUrl, {
        headers: { 'user-agent': this.userAgent },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      return robotsParser(robotsUrl, await res.text());
    } catch {
      return null;
    }
  }
}

/** État des relevés d'une boutique, d'après ses fiches suivies (hors fiches en pause). */
export type ScrapeHealth = 'ok' | 'degraded' | 'down' | 'idle';

export interface ListingHealth {
  consecutiveErrors: number;
  state: string;
  lastSuccessAt: Date | null;
}

/** Sans relevé réussi depuis ce délai, une boutique est considérée en panne. */
export const STALE_SUCCESS_MS = 48 * 3_600_000;

const failing = (l: ListingHealth) =>
  l.consecutiveErrors > 0 || l.state === 'ERROR' || l.state === 'BLOCKED_BY_ROBOTS';

/**
 * - idle : aucune fiche suivie ;
 * - down : toutes les fiches échouent, ou plus aucun relevé réussi depuis 48 h ;
 * - degraded : une partie des fiches échoue ;
 * - ok : tout passe.
 */
export function scrapeHealth(listings: ListingHealth[], now = new Date()): ScrapeHealth {
  if (listings.length === 0) return 'idle';
  const failingCount = listings.filter(failing).length;
  const lastSuccess = Math.max(0, ...listings.map((l) => l.lastSuccessAt?.getTime() ?? 0));
  if (failingCount === listings.length || now.getTime() - lastSuccess > STALE_SUCCESS_MS) {
    return 'down';
  }
  return failingCount > 0 ? 'degraded' : 'ok';
}

export function isFailingListing(l: ListingHealth): boolean {
  return failing(l);
}

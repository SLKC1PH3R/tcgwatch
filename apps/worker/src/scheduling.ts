/** Plafond du backoff après erreurs répétées. */
export const MAX_BACKOFF_MIN = 12 * 60;
/** Nombre d'erreurs consécutives avant de passer le listing en état ERROR (visible dans l'UI). */
export const ERROR_STATE_THRESHOLD = 3;

/**
 * Prochaine vérification après un succès : intervalle + jitter aléatoire de 0 à 25 %
 * (évite que tous les listings tombent sur la même minute).
 */
export function nextCheckAfterSuccess(now: Date, intervalMin: number, random = Math.random): Date {
  const jitter = 1 + random() * 0.25;
  return new Date(now.getTime() + intervalMin * jitter * 60_000);
}

/** Backoff exponentiel : intervalle × 2^erreurs, plafonné à 12 h. */
export function nextCheckAfterError(
  now: Date,
  intervalMin: number,
  consecutiveErrors: number,
  random = Math.random,
): Date {
  const factor = 2 ** Math.min(consecutiveErrors, 10);
  const minutes = Math.min(intervalMin * factor, MAX_BACKOFF_MIN);
  const jitter = 1 + random() * 0.1;
  return new Date(now.getTime() + minutes * jitter * 60_000);
}

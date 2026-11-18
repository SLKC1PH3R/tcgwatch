import type { SealedPrice } from './data/prices';

/**
 * Valeur cumulée d'une famille de produits scellés cotés, et sa variation sur 30 jours à
 * périmètre constant (produits cotés aux deux dates). Partagé par l'indice du marché et l'accueil.
 */
export function familyStats(rows: SealedPrice[]) {
  const quoted = rows.filter((p) => p.market !== null);
  const value = quoted.reduce((s, p) => s + p.market!, 0);
  const both = quoted.filter((p) => p.change30 !== null);
  const now = both.reduce((s, p) => s + p.market!, 0);
  const then = both.reduce((s, p) => s + p.market! / (1 + p.change30!), 0);
  return { value, count: quoted.length, change: then > 0 ? now / then - 1 : null };
}

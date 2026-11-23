import { RARITIES, type RarityKey, rarityKey } from '@tcgwatch/shared';

/** Filtres communs à l'ajout rapide et aux classeurs. */
export interface CardFilters {
  /** Raretés retenues (aucune = toutes). */
  rarities: RarityKey[];
  /** Seulement les cartes qui existent en reverse. */
  reverse: boolean;
  owned: 'toutes' | 'manquantes' | 'possedees';
}

type FilterableCard = { rarity: string | null; variants: string[]; owned: number };

/** Raretés présentes parmi les cartes, dans l'ordre du classeur, avec leur nombre. */
export function rarityCounts(cards: { rarity: string | null }[]) {
  const counts = new Map<RarityKey, number>();
  for (const c of cards) {
    const g = rarityKey(c.rarity);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return RARITIES.filter((g) => counts.has(g.key)).map((g) => ({
    ...g,
    count: counts.get(g.key)!,
  }));
}

/** Variante reverse possible ; sans liste de variantes connue, on ne cache pas la carte. */
export const hasReverse = (c: { variants: string[] }) =>
  c.variants.length === 0 || c.variants.includes('reverse');

export function filterCards<T extends FilterableCard>(
  cards: T[],
  f: CardFilters,
  owned: (c: T) => number = (c) => c.owned,
): T[] {
  return cards.filter(
    (c) =>
      (f.rarities.length === 0 || f.rarities.includes(rarityKey(c.rarity))) &&
      (!f.reverse || hasReverse(c)) &&
      (f.owned === 'toutes' || (f.owned === 'manquantes' ? owned(c) === 0 : owned(c) > 0)),
  );
}

/** Lecture des filtres depuis l'adresse (`?rarete=holo,double&reverse=1&vue=manquantes`). */
export function parseCardFilters(q: {
  rarete?: string;
  reverse?: string;
  vue?: string;
}): CardFilters {
  const keys = new Set<string>(RARITIES.map((g) => g.key));
  return {
    rarities: (q.rarete ?? '').split(',').filter((k): k is RarityKey => keys.has(k)),
    reverse: q.reverse === '1',
    owned: q.vue === 'manquantes' || q.vue === 'possedees' ? q.vue : 'toutes',
  };
}

export function cardFiltersQuery(f: CardFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.rarities.length) out.rarete = f.rarities.join(',');
  if (f.reverse) out.reverse = '1';
  if (f.owned !== 'toutes') out.vue = f.owned;
  return out;
}

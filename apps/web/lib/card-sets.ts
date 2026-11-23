import type { CollectionCard } from '@/lib/data/card-collection';

/**
 * Full Set et Master Set d'une extension. Full Set : une carte de chaque numéro, en version
 * classique (normale, holo…). Master Set : le Full Set plus la reverse de chaque carte qui en a
 * une. Une carte classique compte donc dans les deux, une reverse seulement dans le Master Set.
 */
export type SetMode = 'full' | 'master';

export const SET_MODES: { key: SetMode; label: string }[] = [
  { key: 'full', label: 'Full Set' },
  { key: 'master', label: 'Master Set' },
];

export const parseSetMode = (v: string | undefined): SetMode =>
  v === 'master' ? 'master' : 'full';

type SetCard = Pick<CollectionCard, 'variants' | 'byVariant'>;

/** La carte existe en reverse (variantes connues seulement). */
export const hasReverseSlot = (c: Pick<CollectionCard, 'variants'>) =>
  c.variants.includes('reverse');

/** Exemplaires classiques : toutes les variantes sauf la reverse. */
export const classicCopies = (c: SetCard) =>
  Object.entries(c.byVariant).reduce((n, [v, q]) => (v === 'reverse' ? n : n + q), 0);

export const reverseCopies = (c: SetCard) => c.byVariant.reverse ?? 0;

export interface SetProgress {
  full: { owned: number; total: number };
  /** Absent quand aucune carte de l'extension n'existe en reverse. */
  master: { owned: number; total: number } | null;
}

export function setProgress(cards: SetCard[]): SetProgress {
  const fullOwned = cards.filter((c) => classicCopies(c) > 0).length;
  const reversible = cards.filter(hasReverseSlot);
  const reverseOwned = reversible.filter((c) => reverseCopies(c) > 0).length;
  return {
    full: { owned: fullOwned, total: cards.length },
    master: reversible.length
      ? { owned: fullOwned + reverseOwned, total: cards.length + reversible.length }
      : null,
  };
}

/** Emplacement d'un classeur : une carte dans une variante, avec ses exemplaires. */
export interface SetSlot {
  key: string;
  card: CollectionCard;
  variant: 'normal' | 'reverse';
  owned: number;
}

/** Emplacements dans l'ordre du classeur : en Master Set, la reverse suit la carte classique. */
export function setSlots(cards: CollectionCard[], mode: SetMode): SetSlot[] {
  return cards.flatMap((card) => {
    const classic: SetSlot = {
      key: card.id,
      card,
      variant: 'normal',
      owned: classicCopies(card),
    };
    if (mode !== 'master' || !hasReverseSlot(card)) return [classic];
    return [
      classic,
      { key: `${card.id}:reverse`, card, variant: 'reverse', owned: reverseCopies(card) },
    ];
  });
}

export const percent = (p: { owned: number; total: number }) =>
  p.total ? Math.round((p.owned / p.total) * 100) : 0;

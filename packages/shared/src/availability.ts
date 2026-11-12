export const AVAILABILITIES = ['IN_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'UNKNOWN'] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  IN_STOCK: 'En stock',
  OUT_OF_STOCK: 'Rupture',
  PREORDER: 'Précommande',
  UNKNOWN: 'Inconnu',
};

/** Disponibilité « achetable » (en stock ou précommande ouverte). */
export function isBuyable(a: Availability): boolean {
  return a === 'IN_STOCK' || a === 'PREORDER';
}

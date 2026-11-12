import type { Availability } from '@tcgwatch/shared';

export type AlertKind = 'BACK_IN_STOCK' | 'PREORDER_OPEN' | 'PRICE_TARGET';

export interface ListingState {
  availability: Availability;
  price: number | null;
}

export interface DetectedAlert {
  type: AlertKind;
  dedupeKey: string;
}

/**
 * Compare l'état précédent d'un listing au nouveau relevé et renvoie les alertes à émettre.
 *
 * - BACK_IN_STOCK : passage à « en stock » depuis tout autre état connu.
 * - PREORDER_OPEN : ouverture d'une précommande (depuis rupture / inconnu).
 * - PRICE_TARGET : le prix passe sous (ou égale) la cible alors qu'il était au-dessus ou inconnu,
 *   et le produit est achetable.
 *
 * Le premier relevé d'un listing (état précédent UNKNOWN et jamais relevé) n'émet pas
 * de retour en stock, pour éviter une rafale d'alertes à l'ajout d'URL.
 */
export function detectAlerts(
  listingId: string,
  prev: ListingState,
  next: ListingState,
  targetPrice: number | null,
  isFirstCheck: boolean,
): DetectedAlert[] {
  const alerts: DetectedAlert[] = [];

  if (!isFirstCheck && next.availability === 'IN_STOCK' && prev.availability !== 'IN_STOCK') {
    alerts.push({ type: 'BACK_IN_STOCK', dedupeKey: `BACK_IN_STOCK:${listingId}` });
  }

  if (
    next.availability === 'PREORDER' &&
    (prev.availability === 'OUT_OF_STOCK' || (prev.availability === 'UNKNOWN' && !isFirstCheck))
  ) {
    alerts.push({ type: 'PREORDER_OPEN', dedupeKey: `PREORDER_OPEN:${listingId}` });
  }

  const buyable = next.availability === 'IN_STOCK' || next.availability === 'PREORDER';
  if (targetPrice !== null && next.price !== null && buyable && next.price <= targetPrice) {
    const wasAbove = prev.price === null || prev.price > targetPrice;
    const wasNotBuyable = prev.availability !== 'IN_STOCK' && prev.availability !== 'PREORDER';
    if (wasAbove || wasNotBuyable) {
      alerts.push({
        type: 'PRICE_TARGET',
        dedupeKey: `PRICE_TARGET:${listingId}:${next.price.toFixed(2)}`,
      });
    }
  }

  return alerts;
}

/** Cible effective : celle du listing prime sur celle du produit. */
export function effectiveTarget(listingTarget: number | null, productTarget: number | null) {
  return listingTarget ?? productTarget;
}

/** Frais de port d'une boutique (colis standard en France métropolitaine). */
export interface Shipping {
  /** Frais de port, null = inconnus. */
  cost: number | null;
  /** Port offert à partir de ce montant de commande, null = jamais (ou inconnu). */
  freeFrom: number | null;
}

/** Frais de port pour une commande de ce seul article, null si inconnus. */
export function shippingFor(price: number, shipping: Shipping): number | null {
  if (shipping.freeFrom !== null && price >= shipping.freeFrom) return 0;
  return shipping.cost;
}

/** Prix livré (article + port), null si le port est inconnu. */
export function deliveredPrice(price: number | null, shipping: Shipping): number | null {
  if (price === null) return null;
  const fee = shippingFor(price, shipping);
  return fee === null ? null : Math.round((price + fee) * 100) / 100;
}

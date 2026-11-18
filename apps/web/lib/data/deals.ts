import type { SealedPrice } from './prices';

/** Remise minimale pour parler de bon plan (sous la cote ou sous le prix public). */
export const MIN_DISCOUNT = 0.03;

export interface Deal {
  p: SealedPrice;
  offer: number;
  vsMarket: number | null;
  vsMsrp: number | null;
  /** Meilleure remise des deux références. */
  discount: number;
}

const discountVs = (offer: number, ref: number | null) => (ref && ref > 0 ? 1 - offer / ref : null);

/**
 * Bons plans : offres achetables moins chères que la cote du marché du jour ou que le prix public
 * conseillé (au moins MIN_DISCOUNT). Partagé par la page Bons plans et l'accueil.
 */
export function findDeals(sealed: SealedPrice[]): Deal[] {
  return sealed
    .filter((p) => p.bestOffer !== null && p.bestUrl)
    .map((p) => {
      const offer = p.bestOffer!;
      const vsMarket = discountVs(offer, p.market);
      const vsMsrp = discountVs(offer, p.msrp);
      return { p, offer, vsMarket, vsMsrp, discount: Math.max(vsMarket ?? -1, vsMsrp ?? -1) };
    })
    .filter((d) => d.discount >= MIN_DISCOUNT);
}

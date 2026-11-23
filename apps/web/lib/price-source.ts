/** Prix affichés pour les cartes : cote Cardmarket (toutes langues) ou annonces eBay en français. */
export type PriceSource = 'cardmarket' | 'ebay';

export const PRICE_COOKIE = 'tcgwatch_price';

export const parsePriceSource = (v: string | undefined): PriceSource =>
  v === 'ebay' ? 'ebay' : 'cardmarket';

export const PRICE_SOURCES: { key: PriceSource; label: string; hint: string }[] = [
  { key: 'cardmarket', label: 'Cardmarket', hint: 'cote tendance, toutes langues' },
  { key: 'ebay', label: 'eBay FR', hint: 'médiane des annonces en français' },
];

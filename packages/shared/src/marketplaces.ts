import { isBoosterBundle, isHalfDisplay } from './product-types';
import { fold } from './search';

/**
 * Places de marché d'occasion et de particuliers : mots-clés de recherche d'un produit,
 * tri des annonces hors sujet, liens de recherche préremplis (Leboncoin, Vinted, eBay,
 * Cardmarket). Leboncoin, Vinted et Cardmarket ne sont pas lus par TCGWatch (pas d'API
 * ouverte, conditions d'utilisation) : seulement des liens, et leurs propres alertes.
 */

export interface MarketProduct {
  name: string;
  type: string;
  marketQuery?: string | null;
  extension?: { nameFr: string; setCode?: string | null } | null;
}

/** Mot du format, tel que l'écrivent les vendeurs. */
function typeWord(p: MarketProduct): string | null {
  switch (p.type) {
    case 'ETB':
      return 'ETB';
    case 'DISPLAY':
      return isHalfDisplay(p.name) ? 'demi display' : 'display';
    case 'UPC':
      return 'UPC';
    case 'TRIPACK':
      return 'tripack';
    case 'BOOSTER':
      return isBoosterBundle(p.name) ? 'bundle' : null;
    default:
      return null;
  }
}

/** Mots-clés de recherche : ceux choisis, sinon « ETB Nuit Noire », sinon le nom du produit. */
export function marketSearchQuery(p: MarketProduct): string {
  if (p.marketQuery?.trim()) return p.marketQuery.trim();
  const word = typeWord(p);
  if (word && p.extension) return `${word} ${p.extension.nameFr}`;
  return p.name
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[-–—:|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lots, boîtes vides, autres langues, accessoires : pas le produit scellé cherché. */
const OFF_TOPIC =
  /\b(vide|empty|sans boosters?|lots? de cartes|proxy|fake|japonais|japanese|jap|jpn|chinois|chinese|coreen|korean|english|anglais|classeur|carte seule|promo seule|repack|replique)\b/;

/** Mots qui doivent figurer dans le titre selon le format. */
const TYPE_TERMS: Record<string, RegExp> = {
  ETB: /\b(etb|coffret dresseur|dresseur d elite|elite trainer)\b/,
  DISPLAY: /\b(display|boite de boosters?|booster box|36 boosters?|18 boosters?)\b/,
  UPC: /\b(upc|ultra premium|ultra-premium)\b/,
  TRIPACK: /\b(tripack|tri-pack|3 boosters?|3-pack)\b/,
};

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'l', 'd', 'a', 'en']);

/**
 * L'annonce parle-t-elle bien de ce produit ? Même format (ETB, display…, demi-display ou
 * non), mots du nom de l'extension (ou son code) présents, pas de lot ni de boîte vide.
 */
export function relevantMarketListing(title: string, p: MarketProduct): boolean {
  const t = fold(title).replace(/[^a-z0-9]+/g, ' ');
  if (OFF_TOPIC.test(t)) return false;
  const terms = TYPE_TERMS[p.type];
  if (terms && !terms.test(t)) return false;
  if (p.type === 'DISPLAY' && isHalfDisplay(p.name) !== /\b(demi|18 boosters?)\b/.test(t)) {
    return false;
  }
  if (p.extension) {
    const words = fold(p.extension.nameFr)
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 1 && !STOP.has(w));
    const code = p.extension.setCode ? fold(p.extension.setCode).replace(/[^a-z0-9]/g, '') : null;
    const hasWords = words.length > 0 && words.every((w) => new RegExp(`\\b${w}`).test(t));
    const hasCode = code ? t.replace(/ /g, '').includes(code) : false;
    if (!hasWords && !hasCode) return false;
  }
  return true;
}

/** Chemin des catégories de produits scellés Cardmarket dans les adresses du site. */
const CARDMARKET_PATHS: Record<string, string> = {
  'Pokémon Booster': 'Boosters',
  'Pokémon Display': 'Booster-Boxes',
  'Pokémon Elite Trainer Boxes': 'Elite-Trainer-Boxes',
  'Pokémon Box Set': 'Box-Sets',
  'Pokémon Tins': 'Tins',
  'Pokémon Blisters': 'Blisters',
  'Pokémon Theme Decks': 'Theme-Decks',
  'Pokémon Trainer Kits': 'Trainer-Kits',
};

/** Nom Cardmarket → segment d'adresse : « Black & White Booster Box » → « Black-White-Booster-Box ». */
export function cardmarketSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface CardmarketRef {
  name?: string | null;
  category?: string | null;
}

/**
 * Fiche Cardmarket du produit, offres en français (`language=2`) ; recherche sur le nom quand
 * la catégorie n'a pas d'adresse connue.
 */
export function cardmarketUrl(ref: CardmarketRef, fallbackQuery: string): string {
  const path = ref.category ? CARDMARKET_PATHS[ref.category] : undefined;
  const slug = ref.name ? cardmarketSlug(ref.name) : '';
  if (path && slug) {
    return `https://www.cardmarket.com/fr/Pokemon/Products/${path}/${slug}?language=2`;
  }
  return `https://www.cardmarket.com/fr/Pokemon/Products/Search?${new URLSearchParams({
    searchString: ref.name ?? fallbackQuery,
  })}`;
}

export interface MarketplaceLink {
  key: 'leboncoin' | 'vinted' | 'ebay' | 'cardmarket';
  label: string;
  url: string;
}

/**
 * Recherches préremplies, les plus récentes d'abord, jusqu'au bon prix : Leboncoin (France
 * entière, remise en main propre possible), Vinted (neuf), eBay (neuf, France), Cardmarket
 * (fiche du produit, offres en français, quand le produit Cardmarket est connu).
 */
export function marketplaceLinks(
  query: string,
  maxPrice: number | null,
  cardmarket?: CardmarketRef | null,
): MarketplaceLink[] {
  const max = maxPrice ? String(Math.round(maxPrice)) : null;
  const lbc = new URLSearchParams({ text: query, sort: 'time', order: 'desc' });
  if (max) lbc.set('price', `min-${max}`);
  const vinted = new URLSearchParams({ search_text: query, order: 'newest_first' });
  vinted.append('status_ids[]', '6');
  vinted.append('status_ids[]', '1');
  if (max) vinted.set('price_to', max);
  const ebay = new URLSearchParams({
    _nkw: query,
    _sop: '10',
    LH_ItemCondition: '1000',
    LH_PrefLoc: '1',
  });
  if (max) ebay.set('_udhi', max);
  return [
    {
      key: 'leboncoin',
      label: 'Leboncoin',
      url: `https://www.leboncoin.fr/recherche?${lbc}`,
    },
    { key: 'vinted', label: 'Vinted', url: `https://www.vinted.fr/catalog?${vinted}` },
    { key: 'ebay', label: 'eBay', url: `https://www.ebay.fr/sch/i.html?${ebay}` },
    {
      key: 'cardmarket',
      label: 'Cardmarket',
      url: cardmarketUrl(cardmarket ?? {}, query),
    },
  ];
}

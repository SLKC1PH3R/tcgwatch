export const PRODUCT_TYPES = [
  'ETB',
  'DISPLAY',
  'TRIPACK',
  'BOOSTER',
  'BLISTER',
  'COFFRET',
  'UPC',
  'MINI_TIN',
  'POKEBOX',
  'DECK',
  'AUTRE',
] as const;
export type ProductTypeKey = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductTypeKey, string> = {
  ETB: 'Coffret Dresseur d’Élite (ETB)',
  DISPLAY: 'Display',
  TRIPACK: 'Tripack',
  BOOSTER: 'Booster',
  BLISTER: 'Blister',
  COFFRET: 'Coffret / Collection',
  UPC: 'Ultra Premium Collection',
  MINI_TIN: 'Mini Tin',
  POKEBOX: 'Pokébox',
  DECK: 'Deck',
  AUTRE: 'Autre',
};

/** Devine le type de produit à partir d'un intitulé de fiche revendeur. */
export function guessProductType(title: string): ProductTypeKey {
  const t = title.toLowerCase();
  if (/dresseur d.?[ée]lite|elite trainer box|\betb\b/.test(t)) return 'ETB';
  // « Display Baggaïd 3 Boosters » : un pack vendu en présentoir, pas une boîte de 36.
  if (/display/.test(t) && /\b3\s*boosters?\b/.test(t)) return 'TRIPACK';
  if (/display/.test(t) && /\b2\s*boosters?\b/.test(t)) return 'BLISTER';
  if (/display|bo[iî]te de boosters|36 boosters|18 boosters/.test(t)) return 'DISPLAY';
  if (/tri-?pack|packs? (?:de )?3 boosters/.test(t)) return 'TRIPACK';
  if (/ultra.?premium|\bupc\b/.test(t)) return 'UPC';
  if (/mini.?tin|\btin\b|mini-?bo[iî]te/.test(t)) return 'MINI_TIN';
  if (/pok[ée]box/.test(t)) return 'POKEBOX';
  if (/\bdecks?\b/.test(t)) return 'DECK';
  if (/blister|duo-?pack|pack 2 boosters/.test(t)) return 'BLISTER';
  if (/coffret|collection/.test(t)) return 'COFFRET';
  if (/booster/.test(t)) return 'BOOSTER';
  return 'AUTRE';
}

/**
 * Forme canonique d'un EAN/UPC/GTIN : chiffres seuls, zéros de tête retirés
 * (« 0196214134966 » et « 196214134966 » désignent le même produit). null si invalide.
 */
export function normalizeEan(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '').replace(/^0+/, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

/**
 * Nombre de boosters d'un produit scellé, pour comparer les formats au prix par booster.
 * Lu dans l'intitulé (« 9 boosters », « Display 18 boosters ») ou déduit du type ;
 * null quand le contenu varie trop (coffrets, UPC, decks).
 */
export function boosterCount(name: string, type: string): number | null {
  const t = name.toLowerCase();
  const explicit = /\b(\d{1,2})\s*boosters?\b/.exec(t);
  if (explicit) return Number(explicit[1]);
  switch (type) {
    case 'BOOSTER':
      return /\blot\b|\bbundle\b/.test(t) ? 6 : 1;
    case 'DISPLAY':
      if (/mini.?(?:tin|bo[iî]te)/.test(t)) return null;
      return /\bdemi\b/.test(t) ? 18 : 36;
    case 'ETB':
      return 9;
    case 'TRIPACK':
      return 3;
    case 'BLISTER':
      return /duo-?pack|pack 2/.test(t) ? 2 : 1;
    case 'MINI_TIN':
      return 2;
    default:
      return null;
  }
}

/** Demi-display (18 boosters) : rangé à part des displays de 36. */
export const isHalfDisplay = (name: string) => /\bdemi\b|demi-|\b18 boosters?\b/i.test(name);
/** Lot de 6 boosters (« bundle », « lot de boosters ») : rangé à part des boosters seuls. */
export const isBoosterBundle = (name: string) =>
  /\bbundle\b|\blot\b(?!\s*(?:de\s*)?(?:[1-57-9]|\d{2,})\s*boosters?)/i.test(name);

export interface PriceCategory {
  key: string;
  /** Libellé court (menu). */
  label: string;
  /** Titre de page (« Prix des … »). */
  title: string;
  types: ProductTypeKey[];
  match?: (name: string) => boolean;
}

/**
 * Catégories des pages « Prix » : types de produits, avec les demi-displays et les bundles
 * séparés de leur type d'origine (lus dans le nom).
 */
export const PRICE_CATEGORIES: PriceCategory[] = [
  { key: 'etb', label: 'ETB', title: 'Coffrets Dresseur d’Élite (ETB)', types: ['ETB'] },
  {
    key: 'display',
    label: 'Display',
    title: 'Displays de 36 boosters',
    types: ['DISPLAY'],
    match: (n) => !isHalfDisplay(n),
  },
  {
    key: 'demi-display',
    label: 'Demi-display',
    title: 'Demi-displays de 18 boosters',
    types: ['DISPLAY'],
    match: isHalfDisplay,
  },
  {
    key: 'bundle',
    label: 'Bundle',
    title: 'Bundles (lots de 6 boosters)',
    types: ['BOOSTER'],
    match: isBoosterBundle,
  },
  { key: 'tripack', label: 'Tripack', title: 'Tripacks', types: ['TRIPACK'] },
  {
    key: 'booster',
    label: 'Booster',
    title: 'Boosters à l’unité',
    types: ['BOOSTER'],
    match: (n) => !isBoosterBundle(n),
  },
  { key: 'coffret', label: 'Coffret', title: 'Coffrets et collections', types: ['COFFRET'] },
  { key: 'upc', label: 'UPC', title: 'Ultra Premium Collections', types: ['UPC'] },
  { key: 'pokebox', label: 'Pokébox', title: 'Pokébox', types: ['POKEBOX'] },
  { key: 'mini-tin', label: 'Mini Tin', title: 'Mini Tins', types: ['MINI_TIN'] },
  { key: 'blister', label: 'Blister', title: 'Blisters et duopacks', types: ['BLISTER'] },
  { key: 'deck', label: 'Deck', title: 'Decks', types: ['DECK'] },
];

/** Catégorie de prix d'un produit (null pour « Autre »). */
export function priceCategoryOf(name: string, type: string): PriceCategory | null {
  return (
    PRICE_CATEGORIES.find(
      (c) => (c.types as string[]).includes(type) && (!c.match || c.match(name)),
    ) ?? null
  );
}

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

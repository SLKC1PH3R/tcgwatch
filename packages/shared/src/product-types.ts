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
  AUTRE: 'Autre',
};

/** Devine le type de produit à partir d'un intitulé de fiche revendeur. */
export function guessProductType(title: string): ProductTypeKey {
  const t = title.toLowerCase();
  if (/dresseur d.?[ée]lite|\betb\b/.test(t)) return 'ETB';
  if (/display|36 boosters|18 boosters/.test(t)) return 'DISPLAY';
  if (/tri-?pack|pack 3 boosters|3 boosters/.test(t)) return 'TRIPACK';
  if (/ultra.?premium|\bupc\b/.test(t)) return 'UPC';
  if (/mini.?tin/.test(t)) return 'MINI_TIN';
  if (/pok[ée]box/.test(t)) return 'POKEBOX';
  if (/blister/.test(t)) return 'BLISTER';
  if (/coffret|collection/.test(t)) return 'COFFRET';
  if (/booster/.test(t)) return 'BOOSTER';
  return 'AUTRE';
}

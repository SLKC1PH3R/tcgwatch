/**
 * Raretés des cartes, avec leur symbole : TCGdex donne une quarantaine de libellés selon les
 * époques et les langues (« Holo Rare V », « Illustration spéciale rare », « Méga Hyper Rare »,
 * « Un Diamant » pour Pocket…), ramenés ici à une rareté par symbole imprimé, dans l'ordre où
 * un collectionneur range son classeur.
 */

/** Dessin du symbole : forme, nombre et teinte (noir, argent, or, arc-en-ciel…). */
export interface RaritySymbol {
  shape: 'circle' | 'diamond' | 'star' | 'crown' | 'promo' | 'none';
  count: 1 | 2 | 3 | 4;
  tone: 'ink' | 'silver' | 'gold' | 'rainbow' | 'pink' | 'shiny';
  /** Lettre ou mention ajoutée au symbole (« V », « M »…). */
  mark?: string;
}

const s = (
  shape: RaritySymbol['shape'],
  count: RaritySymbol['count'],
  tone: RaritySymbol['tone'],
  mark?: string,
): RaritySymbol => ({ shape, count, tone, ...(mark ? { mark } : {}) });

export const RARITIES = [
  { key: 'commune', label: 'Commune', symbol: s('circle', 1, 'ink') },
  { key: 'peu-commune', label: 'Peu commune', symbol: s('diamond', 1, 'ink') },
  { key: 'rare', label: 'Rare', symbol: s('star', 1, 'ink') },
  { key: 'holo', label: 'Rare Holo', symbol: s('star', 1, 'silver') },
  { key: 'lvx', label: 'Rare Holo LV.X', symbol: s('star', 1, 'silver', 'X') },
  { key: 'prime', label: 'Rare Prime', symbol: s('star', 1, 'silver', 'P') },
  { key: 'legende', label: 'Légende', symbol: s('star', 1, 'silver', 'L') },
  { key: 'holo-v', label: 'Holo Rare V', symbol: s('star', 1, 'silver', 'V') },
  { key: 'holo-vmax', label: 'Holo Rare VMAX', symbol: s('star', 1, 'silver', 'VM') },
  { key: 'holo-vstar', label: 'Holo Rare VSTAR', symbol: s('star', 1, 'silver', 'VS') },
  { key: 'radieux', label: 'Radieux', symbol: s('star', 1, 'gold', 'R') },
  { key: 'magnifique', label: 'Magnifique', symbol: s('star', 1, 'rainbow') },
  { key: 'prism', label: 'Prisme Étoile', symbol: s('star', 1, 'rainbow', 'P') },
  { key: 'double', label: 'Double rare', symbol: s('star', 2, 'ink') },
  { key: 'triple', label: 'Triple rare', symbol: s('star', 3, 'ink') },
  { key: 'ultra', label: 'Ultra rare', symbol: s('star', 2, 'silver') },
  { key: 'full-art', label: 'Dresseur Full Art', symbol: s('star', 2, 'silver', 'FA') },
  { key: 'ace-spec', label: 'High-tech rare', symbol: s('star', 1, 'pink') },
  { key: 'illustration', label: 'Illustration rare', symbol: s('star', 1, 'gold') },
  {
    key: 'illustration-speciale',
    label: 'Illustration spéciale rare',
    symbol: s('star', 2, 'gold'),
  },
  { key: 'shiny', label: 'Chromatique rare', symbol: s('star', 1, 'shiny') },
  { key: 'shiny-ultra', label: 'Chromatique ultra rare', symbol: s('star', 2, 'shiny') },
  { key: 'secrete', label: 'Secrète', symbol: s('star', 1, 'gold', 'S') },
  { key: 'hyper', label: 'Hyper rare', symbol: s('star', 3, 'gold') },
  { key: 'mega-attack', label: 'Méga Attaque rare', symbol: s('star', 2, 'rainbow', 'M') },
  { key: 'mega-hyper', label: 'Méga Hyper rare', symbol: s('star', 3, 'rainbow') },
  { key: 'noir-blanc', label: 'Rare Noir Blanc', symbol: s('star', 1, 'ink', 'NB') },
  { key: 'collection-classique', label: 'Collection Classique', symbol: s('star', 1, 'gold', 'C') },
  { key: 'futuriste', label: 'Futuriste rare', symbol: s('star', 1, 'rainbow', 'F') },
  { key: 'rgb', label: 'RGB', symbol: s('star', 3, 'rainbow') },
  { key: 'pikachu', label: 'Pikachu rare', symbol: s('star', 1, 'gold', 'P') },
  { key: 'personnage', label: 'Personnage rare', symbol: s('star', 1, 'gold', 'CH') },
  { key: 'brillant', label: 'Rare Brillant', symbol: s('star', 1, 'shiny', 'B') },
  { key: 'diamant-1', label: 'Un diamant', symbol: s('diamond', 1, 'silver') },
  { key: 'diamant-2', label: 'Deux diamants', symbol: s('diamond', 2, 'silver') },
  { key: 'diamant-3', label: 'Trois diamants', symbol: s('diamond', 3, 'silver') },
  { key: 'diamant-4', label: 'Quatre diamants', symbol: s('diamond', 4, 'silver') },
  { key: 'etoile-1', label: 'Une étoile', symbol: s('star', 1, 'gold') },
  { key: 'etoile-2', label: 'Deux étoiles', symbol: s('star', 2, 'gold') },
  { key: 'etoile-3', label: 'Trois étoiles', symbol: s('star', 3, 'gold') },
  { key: 'chromatique-1', label: 'Un chromatique', symbol: s('star', 1, 'shiny') },
  { key: 'chromatique-2', label: 'Deux chromatiques', symbol: s('star', 2, 'shiny') },
  { key: 'chromatique-3', label: 'Trois chromatiques', symbol: s('star', 3, 'shiny') },
  { key: 'couronne', label: 'Couronne', symbol: s('crown', 1, 'gold') },
  { key: 'promo', label: 'Promo', symbol: s('promo', 1, 'ink') },
  { key: 'sans', label: 'Sans rareté', symbol: s('none', 1, 'ink') },
] as const satisfies readonly { key: string; label: string; symbol: RaritySymbol }[];

export type RarityKey = (typeof RARITIES)[number]['key'];
export type Rarity = (typeof RARITIES)[number];

const BY_KEY = new Map<string, Rarity>(RARITIES.map((r) => [r.key, r]));
export const rarityInfo = (key: RarityKey): Rarity => BY_KEY.get(key)!;

/** Libellé TCGdex (français ou anglais) normalisé → rareté. */
const LABELS: Record<string, RarityKey> = {
  commune: 'commune',
  common: 'commune',
  'peu commune': 'peu-commune',
  uncommon: 'peu-commune',
  rare: 'rare',
  'holo rare': 'holo',
  'rare holo': 'holo',
  'rare holo lv.x': 'lvx',
  'rare prime': 'prime',
  legende: 'legende',
  legend: 'legende',
  'holo rare v': 'holo-v',
  'holo rare vmax': 'holo-vmax',
  'holo rare vstar': 'holo-vstar',
  'radieux rare': 'radieux',
  'radiant rare': 'radieux',
  magnifique: 'magnifique',
  'amazing rare': 'magnifique',
  'prism star': 'prism',
  'double rare': 'double',
  'triple rare': 'triple',
  'ultra rare': 'ultra',
  'dresseur full art': 'full-art',
  'full art trainer': 'full-art',
  'high-tech rare': 'ace-spec',
  'ace spec rare': 'ace-spec',
  'illustration rare': 'illustration',
  'illustration speciale rare': 'illustration-speciale',
  'special illustration rare': 'illustration-speciale',
  'shiny rare': 'shiny',
  'shiny rare v': 'shiny',
  'shiny rare vmax': 'shiny',
  'chromatique rare': 'shiny',
  'chromatique ultra rare': 'shiny-ultra',
  'shiny ultra rare': 'shiny-ultra',
  // « Magnifique rare » : traduction TCGdex de « Secret Rare ».
  'magnifique rare': 'secrete',
  'secret rare': 'secrete',
  'rare secrete': 'secrete',
  'hyper rare': 'hyper',
  'mega attack rare': 'mega-attack',
  'mega hyper rare': 'mega-hyper',
  'rare noir blanc': 'noir-blanc',
  'black white rare': 'noir-blanc',
  'collection classique': 'collection-classique',
  'classic collection': 'collection-classique',
  'futuristic rare': 'futuriste',
  'futuriste rare': 'futuriste',
  'rgb rare': 'rgb',
  rgb: 'rgb',
  'pikachu rare': 'pikachu',
  'character rare': 'personnage',
  'character super rare': 'personnage',
  'rare shining': 'brillant',
  'un diamant': 'diamant-1',
  'one diamond': 'diamant-1',
  'deux diamants': 'diamant-2',
  'two diamond': 'diamant-2',
  'trois diamants': 'diamant-3',
  'three diamond': 'diamant-3',
  'quatre diamants': 'diamant-4',
  'four diamond': 'diamant-4',
  'une etoile': 'etoile-1',
  'one star': 'etoile-1',
  'deux etoiles': 'etoile-2',
  'two star': 'etoile-2',
  'trois etoiles': 'etoile-3',
  'three star': 'etoile-3',
  'un chromatique': 'chromatique-1',
  'one shiny': 'chromatique-1',
  'deux chromatiques': 'chromatique-2',
  'two shiny': 'chromatique-2',
  'trois chromatiques': 'chromatique-3',
  'three shiny': 'chromatique-3',
  couronne: 'couronne',
  crown: 'couronne',
  promo: 'promo',
  'sans rarete': 'sans',
  none: 'sans',
};

/** Rareté d'un libellé TCGdex (français ou anglais). */
export function rarityKey(rarity: string | null | undefined): RarityKey {
  const r = (rarity ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!r) return 'sans';
  const exact = LABELS[r];
  if (exact) return exact;
  // Libellés inattendus : rapprochés de la rareté la plus proche.
  if (r.includes('promo')) return 'promo';
  if (/shiny|chromatique/.test(r)) return r.includes('ultra') ? 'shiny-ultra' : 'shiny';
  if (r.includes('hyper')) return r.includes('mega') ? 'mega-hyper' : 'hyper';
  if (r.includes('illustration'))
    return /special|speciale/.test(r) ? 'illustration-speciale' : 'illustration';
  if (/secret|gold/.test(r)) return 'secrete';
  if (r.includes('ultra')) return 'ultra';
  if (r.includes('double')) return 'double';
  if (r.includes('holo')) return 'holo';
  return 'sans';
}

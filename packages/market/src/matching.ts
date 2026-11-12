import { guessProductType, type ProductTypeKey } from '@tcgwatch/shared';

/**
 * Rapprochement d'un intitulé de fiche revendeur avec le catalogue FR.
 *
 * Les revendeurs nomment différemment le même produit :
 *   Pokécardex : « Coffret Dresseur d’élite Méga-Évolution - Règne Delta »
 *   Play-In    : « Coffret Dresseur d'élite (ETB) Pokémon : Règne Delta [ME06] - FR »
 *   Philibert  : « Pokémon ME06 - Règne Delta - Pack 3 Boosters »
 * On compare donc le TYPE de produit (exactement) puis les mots distinctifs
 * (extension, illustration, Pokémon mis en avant), sans les mots de type, de marque,
 * de série ni les codes d'extension.
 */

/** Mots ignorés : articles, marque, série, langue, mots de type de produit, bruit commercial. */
const NOISE = new Set(
  `pokemon jcc tcg trading card game cartes carte fr vf version francaise francais officiel
   de d du des la le les l et a au aux en avec pour sur un une the company
   mega evolution ecarlate violet epee bouclier soleil lune serie ex
   coffret coffrets dresseur elite etb display displays boite boites booster boosters
   tripack tri pack packs blister blisters collection collections pokebox mini tin tins
   ultra premium upc duopack duo deck decks precommande nouveau nouveaute edition sortie
   cards card set sets`
    .split(/\s+/)
    .filter(Boolean),
);

/** Codes d'extension : ME06, EV8, EB11, SV10, SWSH12, ME2.5… */
const SET_CODE = /^(?:me|ev|eb|sv|swsh|ssh|sm|xy|bw|m)\d+(?:[.,]\d+)?[a-z]?$/;

/** Marqueurs d'une version non française (le catalogue est 100 % FR). */
const FOREIGN_WORD =
  /\b(?:anglais|anglaise|english|japonais|japonaise|japanese|cor[ée]en(?:ne)?|korean|chinois(?:e)?|chinese|simplified|allemand|italien|espagnol|portugais)\b/i;
/** Codes de langue en capitales seulement (« EN », « [CN] ») : « en » est un mot français. */
const FOREIGN_CODE = /(?:^|[\s[(\-–])(?:EN|ENG|UK|JP|JAP|JPN|KO|KR|CN|CHN)(?=$|[\s\])\-–])/;

/** Autres jeux de cartes vendus dans les mêmes rayons. */
const OTHER_GAME =
  /\b(?:mtg|magic|palworld|one piece|lorcana|yu-?gi-?oh|dragon ball|digimon|riftbound|star wars unlimited)\b/i;

/** Lots de boîtes (cases, cartons) : un prix sans rapport avec le produit à l'unité. */
const BULK = /\b(?:case|caisse|carton)\b(?! ?(?:de )?rangement)/i;

/** Accessoires et produits dérivés : jamais des produits scellés de cartes. */
const ACCESSORY =
  /prot[eè]ge|protection|crystal ?box|bo[iî]tier|phoenix shield|pok[ée] ?ball|\b(?:lune|hyper|honor|super|master|luxe|soin) ?ball\b|sleeves?|pochettes?|classeur|portfolio|binder|deck ?box|tapis|playmat|toploader|range-?cartes|album|peluche|figurine seule|puzzle|monopoly|jeu de soci[ée]t[ée]|lampe|mug|t-?shirt|sac\b|calendrier de l.avent|4d build|carte[s]? (?:à l'unit[ée]|seule)|gradée?/i;

export function isForeignTitle(title: string): boolean {
  return FOREIGN_WORD.test(title) || FOREIGN_CODE.test(title);
}

/** Accessoire, autre jeu ou lot de boîtes : jamais rapproché d'un produit du catalogue. */
export function isAccessoryTitle(title: string): boolean {
  return ACCESSORY.test(title) || OTHER_GAME.test(title) || BULK.test(title);
}

function normalize(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`]/g, ' ');
}

/** Mots distinctifs d'un intitulé (ensemble trié, sans doublon). */
export function productTokens(title: string): string[] {
  const t = normalize(title);
  const tokens = new Set<string>();
  // Synonymes porteurs de sens, avant de retirer chiffres et mots de type.
  if (/\b30\s*(?:e|eme|a|ans)\b|anniversaire/.test(t)) tokens.add('30ans');
  // « Lot de boosters » = bundle de 6 ; « Lot 4 boosters » (autre nombre) n'en est pas un.
  if (/\bbundle\b|\blot\b(?!\s*(?:de\s*)?(?:[1-57-9]|\d{2,})\s*boosters?)/.test(t))
    tokens.add('bundle');
  if (/\bdemi\b|\b18 boosters\b/.test(t)) tokens.add('demi');
  // « Pokémon2025 » → « pokemon 2025 » : l'année redevient un mot à part.
  for (const word of t.replace(/([a-z])(20\d\d)\b/g, '$1 $2').split(/[^a-z0-9]+/)) {
    // Une année distingue deux produits par ailleurs identiques (« Pack 2 boosters Mars 2025 »).
    if (/^20[1-3]\d$/.test(word)) {
      tokens.add(word);
      continue;
    }
    if (word.length < 2 || NOISE.has(word) || SET_CODE.test(word) || /^\d+[a-z]{0,3}$/.test(word))
      continue;
    if (word === 'ans' || word === 'anniversaire' || word === 'lot' || word === 'bundle') continue;
    tokens.add(word);
  }
  return [...tokens].sort();
}

export interface CatalogProduct {
  id: string;
  name: string;
  type: ProductTypeKey | string;
}

export interface CatalogMatch {
  productId: string;
  /** exact = mêmes mots distinctifs ; partial = l'un contient l'autre, sans ambiguïté. */
  quality: 'exact' | 'partial';
}

const isSubset = (a: string[], b: Set<string>) => a.every((x) => b.has(x));

/**
 * Produit du catalogue correspondant à un intitulé revendeur, ou null.
 * Prudence avant tout : en cas d'ambiguïté (plusieurs produits possibles), aucun rapprochement.
 */
export function matchProduct(title: string, catalog: CatalogProduct[]): CatalogMatch | null {
  if (isForeignTitle(title) || isAccessoryTitle(title)) return null;
  const type = guessProductType(title);
  if (type === 'AUTRE') return null;
  const tokens = productTokens(title);
  if (tokens.length === 0) return null;
  const set = new Set(tokens);
  // « Lot 4 boosters » : ni un booster à l'unité ni un bundle de 6 → pas de rapprochement.
  if (
    type === 'BOOSTER' &&
    !set.has('bundle') &&
    /\b(?:[2-9]|\d{2,})\s*boosters?\b/.test(normalize(title))
  )
    return null;
  // « Lot 2 Tripacks », « Lot de 3 ETB » : plusieurs exemplaires, prix sans rapport.
  if (/\blot\s+(?:de\s+)?(?:[2-9]|\d{2,})\s+(?!boosters?\b)[a-z]/.test(normalize(title)))
    return null;

  const sameType = catalog.filter((p) => p.type === type);
  const exact: CatalogProduct[] = [];
  const partial: CatalogProduct[] = [];
  for (const p of sameType) {
    const pt = productTokens(p.name);
    if (pt.length === 0) continue;
    const ps = new Set(pt);
    if (pt.length === tokens.length && isSubset(pt, set)) exact.push(p);
    else {
      const common = pt.filter((x) => set.has(x)).length;
      if (common >= 2 && (isSubset(pt, set) || isSubset(tokens, ps))) partial.push(p);
    }
  }
  if (exact.length === 1) return { productId: exact[0]!.id, quality: 'exact' };
  if (exact.length > 1) return null;
  if (partial.length === 1) return { productId: partial[0]!.id, quality: 'partial' };
  return null;
}

/**
 * Termes de recherche d'un produit pour le moteur d'un site : les mots distinctifs dans
 * l'ordre d'origine, accents conservés (« Règne Delta », « 30 ans Soirée »).
 */
export function searchQueryFor(name: string): string {
  const words = name
    .replace(/30\s*(?:e|ᵉ|ème)\s*anniversaire/gi, '30 ans')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => {
      const n = normalize(w);
      return n.length >= 2 && !NOISE.has(n) && !SET_CODE.test(n);
    });
  return [...new Set(words)].join(' ');
}

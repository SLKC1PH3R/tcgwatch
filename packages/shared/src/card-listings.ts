import { rarityKey } from './rarity';
import { fold } from './search';

/**
 * Annonces eBay d'une carte à l'unité en français : la cote Cardmarket mélange toutes les
 * langues, une carte rare en français se vend souvent bien plus cher.
 */
export interface ListedCard {
  name: string;
  /** Numéro dans l'extension (« 109 », « 001 », « TG05 »). */
  localId: string;
  rarity?: string | null;
  /** Extension : sert à écarter les autres impressions de la même carte. */
  release?: {
    nameFr: string;
    tcgdexId: string | null;
    /** Nombre de cartes imprimé (« /103 »). */
    cardCountOfficial?: number | null;
  } | null;
}

const words = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/** Numéro sans zéros de tête (« 001 » → « 1 », « TG05 » → « tg5 »). */
const numberKey = (localId: string) =>
  fold(localId)
    .replace(/[^a-z0-9]/g, '')
    .replace(/\d+/g, (n) => String(Number(n)));

/**
 * Rééditions (Collection Classique) : la carte porte le numéro de l'originale (« 4/102 »), pas
 * son numéro dans l'extension.
 */
export const reprintNumbering = (card: ListedCard) =>
  rarityKey(card.rarity) === 'collection-classique' ||
  /classique|classic/.test(fold(card.release?.nameFr ?? '')) ||
  /^(30th-c|cel25c)$/.test(card.release?.tcgdexId ?? '');

const STOP = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'et', 'l', 'd', 'en', 'pokemon']);

/**
 * Mentions qui désignent l'extension dans un titre d'annonce (une seule suffit) : son nom, et
 * les façons usuelles de nommer les éditions anniversaire et les promos.
 */
export function releaseMarkers(release: NonNullable<ListedCard['release']>): string[] {
  const name = words(release.nameFr)
    .filter((w) => !STOP.has(w))
    .join(' ');
  const markers = name ? [name] : [];
  const n = fold(release.nameFr);
  if (/anniversaire|30e|30 ans|celebration/.test(n)) {
    markers.push('30 ans', '30e', '30eme', '30th', 'anniversaire', 'celebration');
  }
  if (/promo/.test(n) || /^[a-z]+p$/i.test(release.tcgdexId ?? '')) {
    markers.push('promo');
    if (release.tcgdexId) markers.push(fold(release.tcgdexId));
  }
  return markers;
}

/** Mots de l'extension ajoutés à la recherche eBay (« Règne Delta », « 30 », « promo »). */
function releaseQuery(release: NonNullable<ListedCard['release']>): string {
  const n = fold(release.nameFr);
  if (/anniversaire|30e|30 ans|celebration/.test(n)) return '30';
  if (/promo/.test(n) || /^[a-z]+p$/i.test(release.tcgdexId ?? '')) return 'promo';
  return release.nameFr;
}

/**
 * Recherche eBay : nom, numéro imprimé (sauf rééditions), extension et une mention de langue française
 * (syntaxe « (a,b) » = l'un ou l'autre).
 */
export function cardListingQuery(card: ListedCard): string {
  // « Méga-Sarmuraï‑ex » (trait d'union insécable) → « Méga-Sarmuraï ex », comme dans les titres.
  const name = card.name
    .replace(/[\u2010\u2011\u2012\u2013]/g, '-')
    .replace(/-(ex|gx|v|vmax|vstar)$/i, ' $1');
  const parts = [name];
  // Numéro complet tel qu'imprimé (« 011/103 ») : c'est ainsi que les vendeurs l'écrivent.
  if (!reprintNumbering(card)) {
    const total = card.release?.cardCountOfficial;
    parts.push(total ? `${card.localId}/${String(total).padStart(3, '0')}` : card.localId);
  }
  if (card.release) parts.push(releaseQuery(card.release));
  parts.push('(fr,vf,francais,français,francaise)');
  return parts.join(' ');
}

const FRENCH = /\b(fr|vf|fra|francais|francaise)\b/;
// Mentions d'une autre langue (pas « en », « de »… : mots français courants).
const OTHER_LANGUAGE =
  /\b(eng|english|anglais|anglaise|jp|jap|japonais|japonaise|japanese|kr|coreen|korean|chinois|chinese|allemand|german|italien|italian|espagnol|spanish)\b/;
/** Cartes gradées, lots, faux et produits dérivés : prix sans rapport avec la carte seule. */
const OFF_TOPIC =
  /\b(psa|pca|cgc|bgs|ccc|ags|beckett|collect aura|gradee?s?|graded|slab|gem mint|lot|lots|bundle|classeur|proxy|custom|fake|replica|orica|fan ?art|metal|gold|plaque|sticker|jumbo|oversize|code)\b/;
/** Mentions qui changent de carte : « Pikachu ex » n'est pas « Pikachu ». */
const SUFFIXES = ['ex', 'gx', 'v', 'vmax', 'vstar', 'break', 'lv', 'prime', 'legende'];

/** L'annonce porte-t-elle bien sur cette carte, de cette extension, en français, seule ? */
export function relevantCardListing(title: string, card: ListedCard): boolean {
  // Plusieurs cartes dans la même annonce (« Pikachu ex + Noctali ex »).
  if (/\s\+\s|\+/.test(title)) return false;
  const t = words(title).join(' ');
  if (!FRENCH.test(t) || OFF_TOPIC.test(t)) return false;
  const cardWords = new Set(words(card.name));
  // « Pikachu ex », « Pikachu V »… pour une carte « Pikachu » : autre carte.
  if (SUFFIXES.some((x) => !cardWords.has(x) && new RegExp(`(^|\\s)${x}(\\s|$)`).test(t))) {
    return false;
  }
  // Promo citée pour une carte d'extension : autre impression.
  const promoSet = card.release ? releaseMarkers(card.release).includes('promo') : false;
  if (!promoSet && /\b(promo|mep|svp|black star)\b/.test(t)) return false;
  // « FR » et une autre langue (« FR/EN au choix ») : langue incertaine.
  if (OTHER_LANGUAGE.test(t)) return false;
  // Version reverse : vendue à part, souvent à un autre prix.
  if (/\breverse\b/.test(t)) return false;
  const name = words(card.name).filter((w) => w.length > 1 && w !== 'ex');
  if (!name.every((w) => t.includes(w))) return false;

  const key = numberKey(card.localId);
  // Zéros de tête retirés, fractions détachées (« 001/103 » → « 1 103 »).
  const compact = t.replace(/\b0+(\d)/g, '$1');
  const has = (w: string) => new RegExp(`(^|\\s)${w}(\\s|$)`).test(compact);
  const total = card.release?.cardCountOfficial;
  // Numéro complet avec le total de l'extension : la carte est identifiée à coup sûr.
  const fullNumber = !!total && new RegExp(`(^|\\s)${key}\\s${total}(\\s|$)`).test(compact);
  if (!reprintNumbering(card) && !fullNumber && !has(key)) return false;
  // Même carte d'une autre extension (Dracaufeu du set de base au lieu de la réédition des
  // 30 ans…) : l'extension doit être nommée, sauf numéro complet.
  if (card.release && !fullNumber) {
    const markers = releaseMarkers(card.release);
    if (markers.length && !markers.some((m) => t.includes(m))) return false;
  }
  return true;
}

/**
 * Rééditions cherchées sans numéro : parmi les annonces gardées, le numéro le plus cité
 * (« 106/105 » pour Celebi brillant) désigne la carte ; les annonces portant un autre numéro
 * (autres Pikachu des 30 ans…) sont écartées. Sans numéro dominant, rien n'est écarté.
 */
export function keepDominantNumber<T extends { title: string }>(listings: T[]): T[] {
  const fraction = (title: string) => {
    const m = /(\d{1,3})\s*\/\s*(\d{2,3})/.exec(title);
    return m ? `${Number(m[1])}/${Number(m[2])}` : null;
  };
  const counts = new Map<string, number>();
  for (const l of listings) {
    const f = fraction(l.title);
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  const [best, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  if (!best || n < 2) return listings;
  return listings.filter((l) => fraction(l.title) === best);
}

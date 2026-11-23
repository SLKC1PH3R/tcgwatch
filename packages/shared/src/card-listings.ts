import { fold } from './search';

/**
 * Annonces eBay d'une carte à l'unité en français : la cote Cardmarket mélange toutes les
 * langues, une carte rare en français se vend souvent bien plus cher.
 */
export interface ListedCard {
  name: string;
  /** Numéro dans l'extension (« 109 », « 001 », « TG05 »). */
  localId: string;
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
 * Recherche eBay : nom, numéro et une mention de langue française (syntaxe « (a,b) » = l'un ou
 * l'autre).
 */
export function cardListingQuery(card: ListedCard): string {
  return `${card.name} ${numberKey(card.localId)} (fr,vf,francais,français,francaise)`;
}

const FRENCH = /\b(fr|vf|fra|francais|francaise)\b/;
// Mentions d'une autre langue (pas « en », « de »… : mots français courants).
const OTHER_LANGUAGE =
  /\b(eng|english|anglais|anglaise|jp|jap|japonais|japonaise|japanese|kr|coreen|korean|chinois|chinese|allemand|german|italien|italian|espagnol|spanish)\b/;
/** Cartes gradées, lots, faux et produits dérivés : prix sans rapport avec la carte seule. */
const OFF_TOPIC =
  /\b(psa|pca|cgc|bgs|beckett|collect aura|gradee?s?|graded|slab|lot|lots|bundle|collection|classeur|proxy|custom|fake|replica|orica|fan ?art|metal|gold|plaque|sticker|jumbo|oversize|code)\b/;

/** L'annonce porte-t-elle bien sur cette carte, en français, seule et non gradée ? */
export function relevantCardListing(title: string, card: ListedCard): boolean {
  const t = words(title).join(' ');
  if (!FRENCH.test(t) || OFF_TOPIC.test(t)) return false;
  // « FR » et une autre langue (« FR/EN au choix ») : langue incertaine.
  if (OTHER_LANGUAGE.test(t)) return false;
  // Version reverse : vendue à part, souvent à un autre prix.
  if (/\breverse\b/.test(t)) return false;
  const name = words(card.name).filter((w) => w.length > 1 && w !== 'ex');
  if (!name.every((w) => t.includes(w))) return false;
  // Numéro de la carte, avec ou sans zéros de tête, seul ou suivi du total (« 109/165 »).
  const key = numberKey(card.localId);
  const compact = t.replace(/\b0+(\d)/g, '$1');
  return new RegExp(`(^|\\s)${key}(\\s|$)`).test(compact);
}

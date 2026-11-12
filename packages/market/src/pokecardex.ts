import { guessProductType, parsePrice, type ProductTypeKey } from '@tcgwatch/shared';

/**
 * Calendrier des sorties de Pokécardex (https://www.pokecardex.com/calendrier).
 *
 * La page est une application React dont les données sont embarquées dans
 * `window.__VIEW_DATA__.calendarEvents` : on lit ce JSON plutôt que le texte du sujet
 * de forum « Calendrier des sorties », qu'il alimente. Le robots.txt du site autorise la
 * collecte (seul l'entraînement d'IA est exclu) ; un relevé par jour suffit.
 */
export const POKECARDEX_CALENDAR_URL = 'https://www.pokecardex.com/calendrier';
const IMAGE_BASE = 'https://pokecardex.b-cdn.net/assets/images/';

/** Événement brut tel que publié par Pokécardex. */
interface RawEvent {
  id?: unknown;
  id_product?: unknown;
  title?: unknown;
  date?: unknown;
  release_date?: unknown;
  kind?: unknown;
  regions?: unknown;
  image_path?: unknown;
  recommended_price?: unknown;
}

export interface PokecardexRelease {
  /** Identifiant stable : « pokecardex:<id_product> ». */
  externalId: string;
  name: string;
  /** Date de sortie en France (minuit UTC). */
  releaseDate: Date;
  productType: ProductTypeKey;
  imageUrl: string | null;
  /** Prix public conseillé annoncé, s'il est connu. */
  msrp: number | null;
  sourceUrl: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Extrait le JSON `window.__VIEW_DATA__ = {…};` de la page. */
export function extractViewData(html: string): Record<string, unknown> | null {
  const start = html.indexOf('window.__VIEW_DATA__');
  if (start === -1) return null;
  const open = html.indexOf('{', start);
  if (open === -1) return null;
  // Parcours avec suivi des chaînes pour trouver l'accolade fermante correspondante.
  let depth = 0;
  let inString = false;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(open, i + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Produits scellés sortant en France. Les sorties réservées aux États-Unis ou au Japon
 * sont ignorées, ainsi que les entrées sans identifiant produit (extensions japonaises).
 */
export function parsePokecardexCalendar(html: string): PokecardexRelease[] {
  const data = extractViewData(html);
  const events = Array.isArray(data?.calendarEvents) ? (data.calendarEvents as RawEvent[]) : [];
  const out = new Map<string, PokecardexRelease>();

  for (const e of events) {
    const regions = Array.isArray(e.regions) ? e.regions : [];
    if (!regions.includes('fr')) continue;
    if (typeof e.id_product !== 'number' && typeof e.id_product !== 'string') continue;
    const name = typeof e.title === 'string' ? e.title.replace(/\s+/g, ' ').trim() : '';
    const date = typeof e.release_date === 'string' ? e.release_date : e.date;
    if (!name || typeof date !== 'string' || !ISO_DATE.test(date)) continue;

    const path = typeof e.image_path === 'string' ? e.image_path.trim() : '';
    const price = parsePrice(e.recommended_price as string | number | null | undefined);
    const externalId = `pokecardex:${e.id_product}`;
    out.set(externalId, {
      externalId,
      name,
      releaseDate: new Date(`${date}T00:00:00Z`),
      productType: guessProductType(name),
      imageUrl: path
        ? `${IMAGE_BASE}${path.split('/').map(encodeURIComponent).join('/')}?class=product`
        : null,
      msrp: price !== null && price > 0 ? price : null,
      sourceUrl: POKECARDEX_CALENDAR_URL,
    });
  }
  return [...out.values()].sort((a, b) => a.releaseDate.getTime() - b.releaseDate.getTime());
}

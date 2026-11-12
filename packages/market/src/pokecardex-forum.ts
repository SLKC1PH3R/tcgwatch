import { load, type CheerioAPI } from 'cheerio';
import { guessProductType, parsePrice } from '@tcgwatch/shared';
import type { PokecardexRelease } from './pokecardex';

/**
 * Sujets « [FR] Calendrier des sorties JCC Pokémon <année> » du forum Pokécardex : un
 * message par année, tenu à jour par l'équipe, avec pour chaque produit français sa date,
 * son contenu, son prix conseillé et une photo. Pages publiques (forum phpBB), autorisées par
 * le robots.txt du site. Les années 2022 à 2025 suivent le même format ; 2026 est couverte
 * par le calendrier structuré (pokecardex.com/calendrier).
 */
export const POKECARDEX_FORUM_TOPICS: Record<number, number> = {
  2022: 45035,
  2023: 46296,
  2024: 47615,
  2025: 48753,
};

export function pokecardexForumUrl(topicId: number): string {
  return `https://www.pokecardex.com/forums/viewtopic.php?t=${topicId}`;
}

const MONTHS: Record<string, number> = {
  jan: 0,
  janv: 0,
  janvier: 0,
  fev: 1,
  fevr: 1,
  fevrier: 1,
  mar: 2,
  mars: 2,
  avr: 3,
  avril: 3,
  mai: 4,
  juin: 5,
  juil: 6,
  juillet: 6,
  aou: 7,
  aout: 7,
  sep: 8,
  sept: 8,
  septembre: 8,
  oct: 9,
  octobre: 9,
  nov: 10,
  novembre: 10,
  dec: 11,
  decembre: 11,
};

/** Sélection cheerio (évite une dépendance directe à domhandler). */
type Node = ReturnType<CheerioAPI>;

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** « ✔ 07 Fév. : Nom… » : marqueur de statut, jour, mois abrégé. */
const HEAD = /^\s*[^\p{L}\p{N}\s]{1,3}\s*(\d{1,2})(?:er)?\s+([\p{L}]+)\.?\s*:\s*/u;
const PRICE = /(\d+(?:[.,]\d{1,2})?)\s*€/;

function slug(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Espaces normalisés (`\s` couvre aussi l'espace insécable). */
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Texte ligne à ligne d'un élément (les <br> et blocs deviennent des retours à la ligne). */
function lines($: CheerioAPI, el: Node): string[] {
  const clone = el.clone();
  clone.find('br').replaceWith('\n');
  clone.find('li, div, p, blockquote').each((_, n) => {
    $(n).prepend('\n').append('\n');
  });
  return clone.text().split('\n').map(clean).filter(Boolean);
}

function imageOf($: CheerioAPI, li: Node, base: string): string | null {
  const src = li
    .find('img')
    .map((_, img) => $(img).attr('src'))
    .get()
    .find((s) => s && !/smilies|emoji|icon/i.test(s));
  if (!src) return null;
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

/**
 * Produits d'un sujet annuel. Une entrée « Extension : X » donne ses produits de base
 * (booster, display, demi-display) avec leurs prix conseillés ; les accessoires (portfolios…)
 * et les variantes au même prix (display « amélioré ») sont ignorés.
 */
export function parsePokecardexForumCalendar(
  html: string,
  year: number,
  pageUrl: string,
): PokecardexRelease[] {
  const $ = load(html);
  const post = $('.post').first().find('.content').first();
  const out = new Map<string, PokecardexRelease>();

  const add = (r: Omit<PokecardexRelease, 'externalId' | 'productType' | 'sourceUrl'>) => {
    let id = `pokecardex-forum:${year}:${slug(r.name)}`;
    for (let i = 2; out.has(id); i++) id = `pokecardex-forum:${year}:${slug(r.name)}-${i}`;
    out.set(id, {
      ...r,
      externalId: id,
      productType: guessProductType(r.name),
      sourceUrl: pageUrl,
    });
  };

  post.find('li').each((_, el) => {
    const li = $(el);
    // Entrée de premier niveau : le marqueur de statut est dans un <strong> enfant direct.
    if (
      !li
        .children('strong')
        .first()
        .text()
        .trim()
        .match(/^[^\p{L}\p{N}\s]/u)
    )
      return;
    const [head, ...rest] = lines($, li);
    const m = head?.match(HEAD);
    if (!head || !m) return;
    const month = MONTHS[fold(m[2]!)];
    if (month === undefined) return;
    const releaseDate = new Date(Date.UTC(year, month, Number(m[1])));
    const title = head.slice(m[0].length);
    const image = imageOf($, li, pageUrl);

    const extension = title.match(/^Extension\s*:\s*(.+?)\s*(?:\(([^)]+)\))?$/i);
    if (extension) {
      const set = clean(extension[1]!);
      for (const line of rest) {
        const price = parsePrice(line.match(PRICE)?.[1]);
        if (price === null || price <= 0) continue;
        const label = fold(line);
        if (/portfolio|classeur|ameliore|protege|etui/.test(label)) continue;
        let name: string | null = null;
        if (/demi-?display|18 boosters/.test(label)) name = `Demi-display ${set}`;
        else if (/display|boite de 36|presentoir/.test(label)) name = `Display ${set}`;
        else if (/^booster/.test(label)) name = `Booster ${set}`;
        if (name) add({ name, releaseDate, imageUrl: image, msrp: price });
      }
      return;
    }

    // Produit : nom en gras, surnom éventuel entre parenthèses « (ETB EV09) ».
    const name = clean(li.children('strong').eq(1).text()) || clean(title.replace(/\(.*$/, ''));
    if (!name) return;
    const priceLine = rest.find((l) => /prix conseill/i.test(l));
    const price = parsePrice(priceLine?.match(PRICE)?.[1]);
    add({ name, releaseDate, imageUrl: image, msrp: price !== null && price > 0 ? price : null });
  });

  return [...out.values()].sort((a, b) => a.releaseDate.getTime() - b.releaseDate.getTime());
}

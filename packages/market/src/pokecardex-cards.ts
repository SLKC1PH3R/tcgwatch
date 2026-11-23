import { fold } from '@tcgwatch/shared';

/**
 * Versions des cartes d'après Pokécardex (https://www.pokecardex.com/series/<code>) : leurs pages
 * contiennent une version HTML lisible (référencement) avec la liste des cartes de la série et,
 * sur chaque fiche, les versions imprimées (« Standard », « Reverse »…). Sert quand TCGdex
 * n'indique pas encore les reverses d'une extension récente.
 */
export const POKECARDEX_BASE = 'https://www.pokecardex.com';

const NAMED: Record<string, string> = {
  amp: '&',
  quot: '"',
  lt: '<',
  gt: '>',
  apos: "'",
  nbsp: ' ',
};

/** Entités HTML décodées (Pokécardex encode jusqu'aux « / » des liens). */
export function decodeEntities(html: string): string {
  return html.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

const stripTags = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export interface PokecardexSeries {
  code: string;
  name: string;
}

/** Séries listées sur https://www.pokecardex.com/series (code et nom français). */
export function parsePokecardexSeriesIndex(html: string): PokecardexSeries[] {
  const out = new Map<string, PokecardexSeries>();
  const re =
    /<a\b[^>]*href="(?:https?:\/\/www\.pokecardex\.com)?\/series\/([A-Za-z0-9_-]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of decodeEntities(html).matchAll(re)) {
    const name = stripTags(m[2]!);
    if (name && !out.has(m[1]!)) out.set(m[1]!, { code: m[1]!, name });
  }
  return [...out.values()];
}

/** Série Pokécardex portant le nom français de l'extension (un seul candidat). */
export function findPokecardexSeries(
  name: string,
  series: PokecardexSeries[],
): PokecardexSeries | null {
  const key = fold(name).replace(/[^a-z0-9]/g, '');
  const found = series.filter((s) => fold(s.name).replace(/[^a-z0-9]/g, '') === key);
  return found.length === 1 ? found[0]! : null;
}

export interface PokecardexCardLink {
  url: string;
  /** Numéro imprimé, sans le total (« 001 »). */
  number: string;
  name: string;
}

/** Cartes d'une série : « 001/103 Scarhino » → numéro, nom et lien vers la fiche. */
export function parsePokecardexSeriesCards(html: string): PokecardexCardLink[] {
  const re =
    /<a\b[^>]*href="((?:https?:\/\/www\.pokecardex\.com)?\/carte\/\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  const out: PokecardexCardLink[] = [];
  const seen = new Set<string>();
  for (const m of decodeEntities(html).matchAll(re)) {
    const text = stripTags(m[2]!);
    // « 001/103 Scarhino » ou, pour les promos, « 001 Méganium ».
    const num = /^([A-Za-z]*\d+[A-Za-z]*)(?:\s*\/\s*\S+)?\s+(.+)$/.exec(text);
    if (!num) continue;
    const url = m[1]!.startsWith('http') ? m[1]! : POKECARDEX_BASE + m[1]!;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, number: num[1]!, name: num[2]! });
  }
  return out;
}

/**
 * Versions d'une fiche (« Standard », « Reverse »…) traduites en variantes TCGdex. `null` si la
 * fiche n'a pas de section « Versions ».
 */
export function parsePokecardexCardVersions(html: string): string[] | null {
  const m = /<h2[^>]*>\s*Versions\s*<\/h2>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(decodeEntities(html));
  if (!m) return null;
  const items = [...m[1]!.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((l) =>
    fold(stripTags(l[1]!)),
  );
  const variants = new Set<string>();
  for (const v of items) {
    if (v.includes('reverse')) variants.add('reverse');
    else if (v.includes('holo')) variants.add('holo');
    else if (v.includes('standard') || v.includes('normal')) variants.add('normal');
  }
  return [...variants];
}

/**
 * Scan de la carte (CDN Pokécardex) sur sa fiche, tel que publié : le paramètre de taille
 * (`?class=hd`) est indispensable, sans lui le CDN répond 403.
 */
export function parsePokecardexCardImage(html: string): string | null {
  const m = /<img\b[^>]*src="(https:\/\/pokecardex-scans\.b-cdn\.net\/[^"]+)"/i.exec(
    decodeEntities(html),
  );
  return m ? m[1]! : null;
}

/** Adresse affichable d'un scan Pokécardex (ajoute `?class=hd` aux adresses enregistrées sans). */
export const pokecardexScanUrl = (url: string) => (url.includes('?') ? url : `${url}?class=hd`);

/**
 * Série Pokécardex d'une extension : par son nom français, à défaut par son code (« mep » →
 * « MEP » : les promos portent souvent le même code).
 */
export function pokecardexSeriesFor(
  release: { nameFr: string; tcgdexId: string | null },
  series: PokecardexSeries[],
): PokecardexSeries | null {
  const byName = findPokecardexSeries(release.nameFr, series);
  if (byName) return byName;
  const code = release.tcgdexId?.toUpperCase();
  return series.find((s) => s.code.toUpperCase() === code) ?? null;
}

/** Numéro comparable (« 001 » = « 1 »). */
export const pokecardexNumberKey = (n: string) => n.replace(/^0+(?=.)/, '').toUpperCase();

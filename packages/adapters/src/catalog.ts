import { load, type CheerioAPI } from 'cheerio';
import { normalizeEan } from '@tcgwatch/shared';
import { extractJsonLdNodes } from './jsonld';

/** Lien vers une fiche produit trouvé dans une page de rayon ou de recherche. */
export interface CatalogLink {
  title: string;
  url: string;
  /** EAN lu dans l'adresse de la fiche (PrestaShop : « …-0196214144620.html »). */
  ean?: string;
}

/** Titre tronqué par le site (« Pokémon - Octobre 2026 -... »). */
const TRUNCATED = /(?:\.{3}|…)\s*$/;
/** EAN de 12 à 14 chiffres en fin d'adresse. */
const URL_EAN = /-(\d{12,14})(?:\.html?)?$/;

/**
 * Intitulé et EAN tirés de l'adresse d'une fiche : « /jcc-pokemon/35491-pokemon-octobre-2026-
 * pack-2-boosters-piece-fr-0196214155992.html » → « pokemon octobre 2026 pack 2 boosters piece
 * fr » et 196214155992. Sert quand le titre affiché est tronqué.
 */
export function linkInfoFromUrl(url: string): { title: string; ean?: string } {
  let slug = '';
  try {
    slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
  } catch {
    return { title: '' };
  }
  const ean = normalizeEan(slug.match(URL_EAN)?.[1]) ?? undefined;
  const title = slug
    .replace(/\.html?$/, '')
    .replace(URL_EAN, '')
    .replace(/^\d+-+/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return { title, ean };
}

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

/** Liste schema.org ItemList (Play-In et autres sites Next.js). */
function fromItemList($: CheerioAPI, pageUrl: string): CatalogLink[] {
  const out: CatalogLink[] = [];
  for (const node of extractJsonLdNodes($)) {
    const types = ([] as unknown[]).concat(node['@type']);
    if (!types.includes('ItemList') || !Array.isArray(node.itemListElement)) continue;
    for (const el of node.itemListElement as Record<string, unknown>[]) {
      const item = (el.item ?? el) as Record<string, unknown>;
      const url = absolute(typeof item.url === 'string' ? item.url : undefined, pageUrl);
      const title = typeof item.name === 'string' ? clean(item.name) : '';
      if (url && title) out.push({ title, url });
    }
  }
  return out;
}

/** Vignettes produit : PrestaShop 1.6/1.7 et la plupart des thèmes e-commerce. */
function fromMiniatures($: CheerioAPI, pageUrl: string): CatalogLink[] {
  const out: CatalogLink[] = [];
  $('.product-miniature, .ajax_block_product, .product-container, [data-id-product]').each(
    (_, el) => {
      const box = $(el);
      const titleLink = box
        .find('.product-title a, .product-name, .product-miniature__title a, h2 a, h3 a')
        .first();
      const link = titleLink.is('a') ? titleLink : box.find('a[href]').first();
      const url = absolute(link.attr('href'), pageUrl);
      const title =
        clean(titleLink.text()) ||
        clean(link.attr('title')) ||
        clean(box.find('img').first().attr('alt'));
      if (url && title) out.push({ title, url });
    },
  );
  return out;
}

/** Repli : toute ancre vers une URL de fiche produit du site. */
function fromAnchors(
  $: CheerioAPI,
  pageUrl: string,
  productUrl: RegExp,
): (CatalogLink & { fromAlt?: boolean })[] {
  const out: (CatalogLink & { fromAlt?: boolean })[] = [];
  $('a[href]').each((_, el) => {
    const a = $(el);
    const url = absolute(a.attr('href'), pageUrl);
    if (!url || !productUrl.test(url)) return;
    const text = clean(a.text()) || clean(a.attr('title')) || clean(a.attr('aria-label'));
    // Le texte alternatif d'une image est souvent une description SEO : dernier recours.
    const title = text || clean(a.find('img').attr('alt'));
    if (title.length >= 8) out.push({ title, url, fromAlt: !text });
  });
  return out;
}

/**
 * Fiches produit listées dans une page (rayon, résultats de recherche), dédoublonnées par URL
 * (le titre le plus complet est conservé). Seules les URL qui ressemblent à une fiche produit
 * du site (`productUrl`) sont retenues.
 */
export function extractCatalogLinks(
  html: string,
  pageUrl: string,
  productUrl: RegExp,
): CatalogLink[] {
  const $ = load(html);
  // Images en chargement différé : le <noscript> contient du HTML lu comme du texte.
  $('noscript, script, style, template').remove();
  const host = new URL(pageUrl).hostname;
  const best = new Map<string, { title: string; fromAlt: boolean }>();
  for (const link of [
    ...fromItemList($, pageUrl),
    ...fromMiniatures($, pageUrl),
    ...fromAnchors($, pageUrl, productUrl),
  ]) {
    let u: URL;
    try {
      u = new URL(link.url);
    } catch {
      continue;
    }
    if (u.hostname !== host || !productUrl.test(link.url)) continue;
    u.search = '';
    const key = u.toString();
    const fromAlt = 'fromAlt' in link && link.fromAlt === true;
    const current = best.get(key);
    // Un titre affiché l'emporte sur un texte alternatif ; à égalité, le plus complet.
    const better =
      !current ||
      (current.fromAlt && !fromAlt) ||
      (current.fromAlt === fromAlt && link.title.length > current.title.length);
    if (better) best.set(key, { title: link.title, fromAlt });
  }
  return [...best].map(([url, { title }]) => {
    const fromUrl = linkInfoFromUrl(url);
    const useUrl = TRUNCATED.test(title) && fromUrl.title.length >= 8;
    return {
      url,
      title: useUrl ? fromUrl.title : title,
      ...(fromUrl.ean ? { ean: fromUrl.ean } : {}),
    };
  });
}

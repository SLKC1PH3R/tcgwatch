import { load, type CheerioAPI } from 'cheerio';
import { extractJsonLdNodes } from './jsonld';

/** Lien vers une fiche produit trouvé dans une page de rayon ou de recherche. */
export interface CatalogLink {
  title: string;
  url: string;
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
function fromAnchors($: CheerioAPI, pageUrl: string, productUrl: RegExp): CatalogLink[] {
  const out: CatalogLink[] = [];
  $('a[href]').each((_, el) => {
    const a = $(el);
    const url = absolute(a.attr('href'), pageUrl);
    if (!url || !productUrl.test(url)) return;
    const title = clean(a.text()) || clean(a.attr('title')) || clean(a.find('img').attr('alt'));
    if (title.length >= 8) out.push({ title, url });
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
  const host = new URL(pageUrl).hostname;
  const best = new Map<string, string>();
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
    const current = best.get(key);
    if (!current || link.title.length > current.length) best.set(key, link.title);
  }
  return [...best].map(([url, title]) => ({ url, title }));
}

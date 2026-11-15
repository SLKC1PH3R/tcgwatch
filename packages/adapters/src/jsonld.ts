import { load, type CheerioAPI } from 'cheerio';
import { normalizeEan, parseFrenchDate, parsePrice, type Availability } from '@tcgwatch/shared';
import type { ListingResult } from './types';

type Json = Record<string, unknown>;

const SCHEMA_AVAILABILITY: Record<string, Availability> = {
  instock: 'IN_STOCK',
  limitedavailability: 'IN_STOCK',
  onlineonly: 'IN_STOCK',
  instoreonly: 'OUT_OF_STOCK',
  outofstock: 'OUT_OF_STOCK',
  soldout: 'OUT_OF_STOCK',
  discontinued: 'OUT_OF_STOCK',
  backorder: 'PREORDER',
  preorder: 'PREORDER',
  presale: 'PREORDER',
};

/** "https://schema.org/InStock" | "InStock" | "http://schema.org/OutOfStock" → Availability */
export function mapSchemaAvailability(value: unknown): Availability | undefined {
  if (typeof value !== 'string') return undefined;
  const key = value.split('/').pop()?.toLowerCase().trim();
  return key ? SCHEMA_AVAILABILITY[key] : undefined;
}

function isType(node: Json, type: string): boolean {
  const t = node['@type'];
  if (typeof t === 'string') return t.toLowerCase() === type.toLowerCase();
  if (Array.isArray(t))
    return t.some((x) => typeof x === 'string' && x.toLowerCase() === type.toLowerCase());
  return false;
}

/** Aplatit les blocs JSON-LD (tableaux, @graph) en une liste de nœuds. */
function flatten(data: unknown, out: Json[] = []): Json[] {
  if (Array.isArray(data)) {
    for (const d of data) flatten(d, out);
  } else if (data && typeof data === 'object') {
    const node = data as Json;
    out.push(node);
    if (node['@graph']) flatten(node['@graph'], out);
  }
  return out;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Certains sites insèrent des retours à la ligne ou tabulations brutes dans les chaînes.
    try {
      // eslint-disable-next-line no-control-regex -- remplacement volontaire des caractères de contrôle
      return JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' '));
    } catch {
      return undefined;
    }
  }
}

export function extractJsonLdNodes($: CheerioAPI): Json[] {
  const nodes: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    const parsed = safeJsonParse(raw.trim());
    if (parsed !== undefined) flatten(parsed, nodes);
  });
  return nodes;
}

/** Toutes les URL d'un champ `image` schema.org (chaîne, tableau, ImageObject). */
function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) allStrings(x, out);
  else if (v && typeof v === 'object') {
    const o = v as Json;
    const u = o.url ?? o.contentUrl ?? o['@id'];
    if (typeof u === 'string') out.push(u);
  }
  return out;
}

function nameOf(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (Array.isArray(v)) return nameOf(v[0]);
  if (v && typeof v === 'object') return nameOf((v as Json).name);
  return undefined;
}

const MAX_DESCRIPTION = 2000;

/** Texte brut d'une description (HTML et entités retirés, espaces normalisés). */
export function cleanDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const $ = load(`<div>${raw.replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, '</p> ')}</div>`);
  const text = $('div').first().text().replace(/\s+/g, ' ').trim();
  if (text.length < 3) return undefined;
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : text;
}

/** Rayon du produit : dernier élément du fil d'Ariane qui pointe vers une page. */
function breadcrumbCategory(nodes: Json[]): string | undefined {
  const list = nodes.find((n) => isType(n, 'BreadcrumbList'));
  const items = Array.isArray(list?.itemListElement) ? (list.itemListElement as Json[]) : [];
  const linked = items.filter((i) => i && typeof i === 'object' && i.item);
  const last = linked[linked.length - 1];
  const name = last ? (nameOf(last.name) ?? nameOf(last.item)) : undefined;
  return name && !/^accueil$/i.test(name) ? decodeEntities(name) : undefined;
}

function absoluteUrl(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

/** Sélectionne l'offre la plus pertinente (la moins chère parmi celles achetables). */
function pickOffer(offers: unknown): Json | undefined {
  const list = flatten(offers).filter(
    (o) => isType(o, 'Offer') || isType(o, 'AggregateOffer') || 'price' in o,
  );
  if (list.length === 0) return undefined;
  const priced = list
    .map((o) => ({ o, p: parsePrice((o.price ?? o.lowPrice) as string | number | undefined) }))
    .filter((x) => x.p !== null && x.p > 0)
    .sort((a, b) => a.p! - b.p!);
  return priced[0]?.o ?? list[0];
}

/**
 * Lit le JSON-LD schema.org Product/Offer d'une page.
 * Renvoie uniquement les champs trouvés (les adaptateurs spécifiques complètent le reste).
 */
export function parseJsonLd(html: string, url: string): Partial<ListingResult> {
  const $ = load(html);
  return parseJsonLdFrom($, url);
}

export function parseJsonLdFrom($: CheerioAPI, url: string): Partial<ListingResult> {
  const nodes = extractJsonLdNodes($);
  const product = nodes.find((n) => isType(n, 'Product') || isType(n, 'ProductGroup'));
  if (!product) return {};

  const result: Partial<ListingResult> = {};
  if (typeof product.name === 'string') result.title = decodeEntities(product.name);
  const images = uniqueUrls(allStrings(product.image), url);
  if (images.length) {
    result.imageUrl = images[0];
    result.images = images;
  }
  const description = cleanDescription(
    typeof product.description === 'string' ? product.description : undefined,
  );
  if (description) result.description = description;
  const brand = nameOf(product.brand) ?? nameOf(product.manufacturer);
  if (brand) result.brand = decodeEntities(brand);
  if (typeof product.sku === 'string' || typeof product.sku === 'number') {
    const sku = String(product.sku).trim();
    if (sku) result.sku = sku;
  }
  const category = breadcrumbCategory(nodes);
  if (category && category !== result.title) result.category = category;
  const ean = [product.gtin13, product.gtin14, product.gtin, product.gtin12, product.ean].find(
    (v): v is string | number => typeof v === 'string' || typeof v === 'number',
  );
  const normalizedEan = normalizeEan(ean);
  if (normalizedEan) result.ean = normalizedEan;

  const offer = pickOffer(product.offers);
  if (offer) {
    const price = parsePrice((offer.price ?? offer.lowPrice) as string | number | undefined);
    // Un prix à 0 signifie « pas encore en vente » chez plusieurs revendeurs.
    result.price = price !== null && price > 0 ? price : null;
    if (typeof offer.priceCurrency === 'string') result.currency = offer.priceCurrency;
    const availability = mapSchemaAvailability(offer.availability);
    if (availability) result.availability = availability;
    const starts = offer.availabilityStarts ?? offer.validFrom;
    if (typeof starts === 'string' && result.availability === 'PREORDER') {
      const d = parseFrenchDate(starts);
      if (d) result.releaseDate = d;
    }
  }
  if (typeof product.releaseDate === 'string') {
    const d = parseFrenchDate(product.releaseDate);
    if (d) result.releaseDate = d;
  }
  return result;
}

function decodeEntities(s: string): string {
  return load(`<p>${s}</p>`)('p').text().trim();
}

// Formats d'image PrestaShop (« 123-large_default/nom.jpg ») du plus grand au plus petit.
const IMAGE_SIZES = [
  'thickbox',
  'product_main_2x',
  'large',
  'product_main',
  'medium',
  'home',
  'small',
  'cart',
];
const SIZE_RE = /-([a-z0-9_]+?)_default\//i;

function sizeRank(url: string): number {
  const size = url.match(SIZE_RE)?.[1]?.toLowerCase();
  if (!size) return IMAGE_SIZES.length / 2;
  const i = IMAGE_SIZES.indexOf(size);
  return i === -1 ? IMAGE_SIZES.length / 2 : i;
}

/**
 * Déduplique une galerie : une même image déclinée en plusieurs tailles n'est gardée
 * qu'une fois, dans sa plus grande taille. L'ordre d'apparition est conservé.
 */
export function dedupeImages(urls: string[]): string[] {
  const best = new Map<string, string>();
  for (const url of urls) {
    const key = url.replace(SIZE_RE, '-*/');
    const current = best.get(key);
    if (!current || sizeRank(url) < sizeRank(current)) best.set(key, url);
  }
  return [...best.values()];
}

function uniqueUrls(urls: (string | undefined)[], base: string): string[] {
  const out: string[] = [];
  for (const u of urls) {
    const abs = absoluteUrl(u?.trim(), base);
    if (abs && /^https?:/.test(abs) && !out.includes(abs)) out.push(abs);
  }
  return out;
}

/** Métadonnées OpenGraph / meta en secours (titre, images, description, prix, marque). */
export function parseOpenGraph($: CheerioAPI, url: string): Partial<ListingResult> {
  const result: Partial<ListingResult> = {};
  const meta = (sel: string) => $(sel).first().attr('content')?.trim() || undefined;
  const title = meta('meta[property="og:title"]') ?? $('title').first().text();
  if (title?.trim()) result.title = title.trim();
  const images = uniqueUrls(
    $('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]')
      .map((_, el) => $(el).attr('content'))
      .get(),
    url,
  );
  if (images.length) {
    result.imageUrl = images[0];
    result.images = images;
  }
  const description = cleanDescription(
    meta('meta[property="og:description"]') ?? meta('meta[name="description"]'),
  );
  if (description) result.description = description;
  const brand = meta('meta[property="product:brand"], meta[property="og:brand"]');
  if (brand) result.brand = brand;
  const price = $('meta[property="product:price:amount"], meta[property="og:price:amount"]').attr(
    'content',
  );
  const p = parsePrice(price);
  if (p !== null && p > 0) result.price = p;
  return result;
}

/**
 * Microdonnées schema.org (`itemscope itemtype=".../Product"` et `itemprop`), utilisées par
 * les boutiques sans JSON-LD (Ultrajeux…) : nom, prix, disponibilité, EAN, image, marque.
 * Seul le premier produit de la page est lu (les vignettes « produits similaires » suivent).
 */
export function parseMicrodata($: CheerioAPI, url: string): Partial<ListingResult> {
  const scope = $('[itemscope][itemtype*="schema.org/Product" i]').first();
  if (!scope.length) return {};
  // itemprop d'un sous-produit (itemscope imbriqué de type Product) ignorés.
  const prop = (name: string) => {
    const el = scope
      .find(`[itemprop="${name}" i]`)
      .filter(
        (_, e) =>
          $(e).parents('[itemscope][itemtype*="schema.org/Product" i]').first()[0] === scope[0],
      )
      .first();
    if (!el.length) return undefined;
    return (
      (el.attr('content') ?? el.attr('href') ?? el.attr('src') ?? el.text()).trim() || undefined
    );
  };
  const result: Partial<ListingResult> = {};
  const name = prop('name');
  if (name) result.title = decodeEntities(name);
  const price = parsePrice(prop('price'));
  if (price !== null && price > 0) result.price = price;
  const currency = prop('priceCurrency');
  if (currency && /^[A-Z]{3}$/.test(currency)) result.currency = currency;
  const availability = mapSchemaAvailability(prop('availability'));
  if (availability) result.availability = availability;
  const ean = normalizeEan(prop('gtin13') ?? prop('gtin') ?? prop('gtin12') ?? prop('gtin14'));
  if (ean) result.ean = ean;
  const sku = prop('sku');
  if (sku) result.sku = sku;
  const brand = prop('brand');
  if (brand) result.brand = decodeEntities(brand);
  const image = absoluteUrl(prop('image'), url);
  if (image) {
    result.imageUrl = image;
    result.images = [image];
  }
  return result;
}

/**
 * Fusionne des résultats partiels : les premiers ont priorité.
 * `undefined` = champ absent ; `price: null` explicite = « pas de prix pratiqué » et l'emporte.
 */
export function mergeResults(...parts: Partial<ListingResult>[]): ListingResult {
  const out: ListingResult = { price: null, currency: 'EUR', availability: 'UNKNOWN' };
  for (const part of [...parts].reverse()) {
    for (const [k, v] of Object.entries(part)) {
      if (v === undefined) continue;
      if (k === 'availability' && v === 'UNKNOWN') continue;
      if (k === 'images') continue; // fusionnées ci-dessous
      (out as unknown as Record<string, unknown>)[k] = v;
    }
  }
  // Galerie : union de toutes les sources, image principale en tête.
  const images = dedupeImages(
    [out.imageUrl, ...parts.flatMap((p) => p.images ?? [])].filter((u): u is string => !!u),
  );
  if (images.length) {
    out.images = images.slice(0, 12);
    out.imageUrl = images[0];
  }
  return out;
}

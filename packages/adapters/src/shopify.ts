import type { CheerioAPI } from 'cheerio';
import type { ListingResult } from './types';

/**
 * Fiches produit Shopify sans JSON-LD Product : l'objet produit que Shopify insère dans la page
 * (`"price_max":…,"available":true|false`) dit si au moins une variante est achetable, même
 * quand le thème laisse un bouton « Ajouter au panier » caché dans le HTML.
 */
export function parseShopify($: CheerioAPI): Partial<ListingResult> {
  const isShopify =
    $('script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"]').length > 0 ||
    /\bShopify\.shop\s*=|\/cdn\/shop\//.test($.html());
  if (!isShopify) return {};
  let available: boolean | undefined;
  $('script').each((_, el) => {
    if (available !== undefined) return;
    const m = $(el)
      .html()
      ?.match(/"price_max":\d+,"available":(true|false)/);
    if (m) available = m[1] === 'true';
  });
  if (available === undefined) return {};
  return { availability: available ? 'IN_STOCK' : 'OUT_OF_STOCK' };
}

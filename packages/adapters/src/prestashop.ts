import type { CheerioAPI } from 'cheerio';
import { normalizeEan, parsePrice } from '@tcgwatch/shared';
import { availabilityFromText, visibleText } from './heuristics';
import type { ListingResult } from './types';

const PREORDER_RE = /pr[ée]-?command/i;
const OUT_RE =
  /rupture|[ée]puis[ée]|indisponible|plus disponible|non disponible|[àa] venir|bient[ôo]t disponible/i;
const IN_RE = /en stock|disponible|exp[ée]di[ée]/i;

/**
 * Fiches produit PrestaShop 1.7+ (thème Classic et dérivés), très répandues chez les
 * boutiques de jeux françaises : formulaire `#add-to-cart-or-refresh`, bouton
 * `data-button-action="add-to-cart"` (désactivé en rupture) et `#product-availability`.
 *
 * Seule la zone du produit principal est lue : les vignettes « produits similaires »
 * ont leurs propres boutons.
 */
export function parsePrestaShop($: CheerioAPI): Partial<ListingResult> {
  const form = $('#add-to-cart-or-refresh').first();
  if (!form.length) return {};
  const result: Partial<ListingResult> = {};

  const button = form.find('[data-button-action="add-to-cart"], button.add-to-cart').first();
  const buttonText = button.length ? visibleText($, button) : '';
  const disabled =
    button.is('[disabled]') ||
    button.hasClass('disabled') ||
    button.attr('data-is-rupture') === '1';
  const availabilityText = visibleText(
    $,
    $('#product-availability, .js-product-availability, .product-availability').first(),
  );

  if (!disabled && (PREORDER_RE.test(buttonText) || PREORDER_RE.test(availabilityText))) {
    result.availability = 'PREORDER';
  } else if (disabled || OUT_RE.test(availabilityText)) {
    result.availability = 'OUT_OF_STOCK';
  } else if (button.length && (IN_RE.test(availabilityText) || availabilityText === '')) {
    result.availability = 'IN_STOCK';
  } else {
    const fromText = availabilityFromText(`${buttonText} ${availabilityText}`);
    if (fromText !== 'UNKNOWN') result.availability = fromText;
  }

  const priceNode = $('.product-prices .current-price [content], .current-price-value').first();
  const price = parsePrice(priceNode.attr('content') ?? priceNode.text());
  if (price !== null && price > 0) result.price = price;

  const ean = $('[itemprop="gtin13"], .product-reference_ean13 span, [data-ean13]').first();
  const eanValue = normalizeEan(ean.attr('content') ?? ean.attr('data-ean13') ?? ean.text());
  if (eanValue) result.ean = eanValue;

  const images = $('.product-images img, .product-cover img, .js-qv-product-images img')
    .map((_, el) => $(el).attr('data-image-large-src') ?? $(el).attr('src'))
    .get()
    .filter((u): u is string => typeof u === 'string' && /^https?:/.test(u));
  if (images.length) result.images = [...new Set(images)];

  return result;
}

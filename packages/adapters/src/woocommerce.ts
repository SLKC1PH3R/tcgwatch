import type { CheerioAPI } from 'cheerio';
import { parsePrice } from '@tcgwatch/shared';
import type { ListingResult } from './types';

/**
 * Fiches produit WooCommerce sans JSON-LD Product : bloc `p.price` du résumé produit et
 * mention de stock `p.stock` (classes `in-stock`, `out-of-stock`, `available-on-backorder`).
 *
 * Prix : le prix soldé (`ins`) s'il existe, sinon le dernier montant du bloc ; certains
 * thèmes affichent d'abord le prix public conseillé puis le prix de la boutique.
 */
export function parseWooCommerce($: CheerioAPI): Partial<ListingResult> {
  const summary = $('.product .summary, .product .entry-summary, .single-product .product').first();
  const scope = summary.length ? summary : $('body');
  const priceBlock = scope.find('p.price, .price').first();
  if (!priceBlock.length || !priceBlock.find('.woocommerce-Price-amount').length) return {};
  const result: Partial<ListingResult> = {};

  const sale = priceBlock.find('ins .woocommerce-Price-amount').first();
  const amount = sale.length ? sale : priceBlock.find('.woocommerce-Price-amount').last();
  const price = parsePrice(amount.text());
  if (price) {
    result.price = price;
    result.currency = 'EUR';
  }

  const stock = scope.find('.stock').first();
  if (stock.hasClass('out-of-stock')) result.availability = 'OUT_OF_STOCK';
  else if (stock.hasClass('available-on-backorder')) result.availability = 'PREORDER';
  else if (stock.hasClass('in-stock')) result.availability = 'IN_STOCK';
  return result;
}

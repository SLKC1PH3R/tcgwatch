import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { parseFrenchDate, type Availability } from '@tcgwatch/shared';

const DATE_PATTERN = String.raw`(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{1,2}(?:er)?\s+[a-zéûA-ZÉÛ]+\s+\d{4})`;

const RELEASE_DATE_RE = new RegExp(
  String.raw`(?:sortie|parution|disponibilit[ée]|disponible|exp[ée]dition|livraison)\s*(?:pr[ée]vue|estim[ée]e)?\s*(?:le|à partir du|a partir du|dès le|:)?\s*` +
    DATE_PATTERN,
  'i',
);

/** Cherche « Sortie prévue le 27/11/2026 » (et variantes) dans un texte. */
export function findReleaseDate(text: string): Date | undefined {
  const m = text.replace(/\s+/g, ' ').match(RELEASE_DATE_RE);
  if (!m?.[1]) return undefined;
  return parseFrenchDate(m[1]) ?? undefined;
}

const PREORDER_RE = /pr[ée]-?command(?:er|ez)\b/i;
const ADD_TO_CART_RE = /ajouter\s+(?:au|à mon|a mon)\s+panier/i;
const OUT_OF_STOCK_RE =
  /rupture|[ée]puis[ée]|indisponible|plus disponible|bient[ôo]t disponible|[àa] venir|me pr[ée]venir|m['’]alerter|pr[ée]venez-moi|m['’]avertir/i;

/**
 * Déduit la disponibilité à partir des libellés d'action (boutons) d'une zone produit.
 * Ordre : précommande > ajout panier > rupture.
 */
export function availabilityFromText(text: string): Availability {
  const t = text.replace(/\s+/g, ' ');
  if (PREORDER_RE.test(t)) return 'PREORDER';
  if (ADD_TO_CART_RE.test(t)) return 'IN_STOCK';
  if (OUT_OF_STOCK_RE.test(t)) return 'OUT_OF_STOCK';
  return 'UNKNOWN';
}

const STOCK_ALERT_RE =
  /m['’]alerter|me pr[ée]venir|pr[ée]venez-moi|[êe]tre (?:alert[ée]|pr[ée]venu|averti)|alerte (?:de )?(?:stock|disponibilit[ée])|m['’]avertir/i;

/**
 * Détecte un dispositif « M'alerter du retour en stock » dans la zone donnée.
 * Renvoie le lien s'il s'agit d'une ancre, sinon l'URL de la fiche (le bouton est sur la page).
 */
export function findStockAlertUrl(
  $: CheerioAPI,
  scope: Cheerio<AnyNode>,
  pageUrl: string,
): string | undefined {
  let found: string | undefined;
  scope.find('a, button, [role="button"], input[type="submit"]').each((_, el) => {
    if (found) return;
    const node = $(el);
    const label = `${node.text()} ${node.attr('value') ?? ''} ${node.attr('title') ?? ''} ${node.attr('aria-label') ?? ''}`;
    if (!STOCK_ALERT_RE.test(label)) return;
    const href = node.attr('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        found = new URL(href, pageUrl).toString();
        return;
      } catch {
        /* lien invalide : on retombe sur l'URL de la page */
      }
    }
    found = pageUrl;
  });
  return found;
}

/**
 * Première zone trouvée selon l'ordre de PRIORITÉ des sélecteurs
 * (`$('a, b').first()` suivrait l'ordre du document). Repli sur <body>.
 */
export function pickScope($: CheerioAPI, selectors: string[]): Cheerio<AnyNode> {
  for (const sel of selectors) {
    const node = $(sel).first();
    if (node.length) return node;
  }
  return $('body');
}

/** Texte visible d'une zone, sans scripts, styles ni gabarits. */
export function visibleText($: CheerioAPI, scope: Cheerio<AnyNode>): string {
  const clone = scope.clone();
  clone.find('script, style, noscript, template, svg').remove();
  return clone.text().replace(/\s+/g, ' ').trim();
}

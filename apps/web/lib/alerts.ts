import { formatDateTime } from '@tcgwatch/shared';
import type { AlertType } from '@tcgwatch/db';

/** Libellé et couleur de chaque type d'alerte (accueil, fiche produit, centre d'alertes). */
export const ALERT_STYLE: Record<AlertType, { label: string; hint: string; className: string }> = {
  BACK_IN_STOCK: {
    label: 'Retour en stock',
    hint: 'Un produit suivi redevient achetable',
    className: 'text-success',
  },
  PREORDER_OPEN: {
    label: 'Précommande',
    hint: 'Ouverture des précommandes',
    className: 'text-info',
  },
  PRICE_TARGET: {
    label: 'Prix cible',
    hint: 'Le prix passe sous votre bon prix',
    className: 'text-primary',
  },
  NEW_LOW: {
    label: 'Plus bas historique',
    hint: 'Meilleur prix jamais relevé',
    className: 'text-success',
  },
  MARKET_DEAL: {
    label: 'Bon prix',
    hint: 'Annonce eBay ou cote sous votre bon prix',
    className: 'text-success',
  },
  MARKET_MOVE: {
    label: 'Variation marché',
    hint: 'Forte hausse ou baisse de la cote sur 7 jours',
    className: 'text-warning',
  },
  CARD_PRICE: {
    label: 'Carte',
    hint: 'Cote d’une carte suivie au-delà de son seuil',
    className: 'text-chart-2',
  },
  WANTED_PRICE: {
    label: 'Carte recherchée',
    hint: 'Une carte de votre liste de recherche passe sous son prix cible',
    className: 'text-success',
  },
  CARD_RISE: {
    label: 'Hausse d’une carte',
    hint: 'Une carte possédée prend plus que votre seuil en 30 jours',
    className: 'text-warning',
  },
  RELEASE_DATE: {
    label: 'Date de sortie',
    hint: 'Date annoncée ou rappel de sortie',
    className: 'text-info',
  },
};

export const ALERT_TYPES = Object.keys(ALERT_STYLE) as AlertType[];

/** Types qu'on peut couper pour un produit (les alertes de cartes n'ont pas de produit). */
export const PRODUCT_ALERT_TYPES: AlertType[] = [
  'BACK_IN_STOCK',
  'PREORDER_OPEN',
  'PRICE_TARGET',
  'NEW_LOW',
  'MARKET_DEAL',
  'MARKET_MOVE',
  'RELEASE_DATE',
];

/** « il y a 12 min », « il y a 3 h », puis la date. */
export function ago(date: Date): string {
  const min = Math.round((Date.now() - date.getTime()) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return formatDateTime(date);
}

/** « 22:00 » ↔ minutes depuis minuit. */
export function toClock(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function fromClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

import type { Availability } from '@tcgwatch/shared';

export type { Availability };

/** Résultat normalisé d'un relevé de fiche produit. */
export interface ListingResult {
  /** Prix TTC, null si non affiché (produit pas encore commandable). */
  price: number | null;
  currency: string;
  availability: Availability;
  /** Date « Sortie prévue le … » détectée sur la fiche. */
  releaseDate?: Date;
  title?: string;
  /** Image principale (la plus grande disponible). */
  imageUrl?: string;
  /** Galerie complète, image principale incluse, sans doublon. */
  images?: string[];
  /** Description texte (HTML retiré), tronquée à 2 000 caractères. */
  description?: string;
  brand?: string;
  /** Référence interne du revendeur. */
  sku?: string;
  ean?: string;
  /** Rayon du site (dernier niveau du fil d'Ariane), ex. « Booster Pokémon français ». */
  category?: string;
  /** Lien vers le dispositif d'alerte de stock du site, s'il existe. */
  stockAlertUrl?: string;
}

export interface FetchOptions {
  /** Forcer le rendu via Chromium (Playwright). */
  browser?: boolean;
  /** Délai minimal propre au revendeur (prend le pas sur le délai global s'il est plus long). */
  minDelayMs?: number;
}

/**
 * Accès réseau injecté dans les adaptateurs (politesse, robots.txt, Playwright gérés en amont).
 * Permet de tester les adaptateurs sans réseau.
 */
export interface FetchContext {
  fetchHtml(url: string, options?: FetchOptions): Promise<string>;
}

export interface RetailerAdapter {
  /** Identifiant stocké dans Retailer.adapterKey. */
  key: string;
  name: string;
  /** Domaines gérés (sans "www."). Vide = adaptateur générique. */
  domains: string[];
  /** Le site nécessite un rendu JavaScript (Chromium). */
  needsBrowser?: boolean;
  /** Analyse pure d'une page HTML — testée sur fixtures. */
  parse(html: string, url: string): ListingResult;
  fetchListing(url: string, ctx: FetchContext): Promise<ListingResult>;
}

export class AdapterError extends Error {
  constructor(
    message: string,
    readonly code: 'BLOCKED' | 'ROBOTS' | 'HTTP' | 'PARSE' | 'UNSUPPORTED' | 'TIMEOUT',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

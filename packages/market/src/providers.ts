import { z } from 'zod';
import { cardmarketPrice, TcgdexClient } from './tcgdex';

/**
 * Module 3 — prix du marché secondaire.
 *
 * Un provider renvoie des cotations datées ; le worker les enregistre dans `MarketPrice`
 * (un relevé par jour/produit/source, unicité en base) : l'historique se construit seul.
 *
 * ⚠️ Cardmarket n'est jamais scrapé (CGU + Cloudflare) : uniquement saisie manuelle ou API tierces.
 */
export interface ProductRef {
  id: string;
  name: string;
  ean?: string | null;
}

export interface MarketQuote {
  productId: string;
  source: string;
  price: number;
  currency: string;
  date: Date;
}

export interface MarketPriceProvider {
  /** Valeur stockée dans MarketPrice.source. */
  key: string;
  label: string;
  /** false = provider non configuré (ex. clé API absente) ; ignoré par le worker. */
  isEnabled(): boolean;
  /** Relevé automatique ; les providers manuels renvoient une liste vide. */
  fetchQuotes(products: ProductRef[]): Promise<MarketQuote[]>;
}

// ─── Provider manuel (V1) ────────────────────────────────

export const manualQuoteSchema = z.object({
  productId: z.string().min(1),
  price: z.coerce.number().positive('Le prix doit être positif').max(100_000),
  currency: z.string().length(3).default('EUR'),
  date: z.coerce.date(),
});

/** Saisie manuelle du prix constaté sur Cardmarket : les données viennent de l'UI. */
export const manualProvider: MarketPriceProvider & {
  normalize(input: unknown): MarketQuote;
} = {
  key: 'manual',
  label: 'Saisie manuelle (Cardmarket constaté)',
  isEnabled: () => true,
  fetchQuotes: async () => [],
  normalize(input) {
    const q = manualQuoteSchema.parse(input);
    const d = q.date;
    return {
      productId: q.productId,
      source: 'manual',
      price: Math.round(q.price * 100) / 100,
      currency: q.currency,
      // Les dates de formulaire ("2026-11-12") sont parsées en UTC : on reste en UTC.
      date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
    };
  },
};

// ─── Provider PokeTrace (V2, API payante) ────────────────

export class PokeTraceProvider implements MarketPriceProvider {
  readonly key = 'poketrace';
  readonly label = 'PokeTrace (API)';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl: string,
  ) {}

  isEnabled() {
    return Boolean(this.apiKey);
  }

  async fetchQuotes(_products: ProductRef[]): Promise<MarketQuote[]> {
    if (!this.isEnabled()) return [];
    // TODO(V2) : implémenter l'appel PokeTrace.
    //  1. Associer chaque produit scellé à son identifiant PokeTrace (recherche par EAN puis par nom).
    //  2. GET `${this.baseUrl}/...` avec l'en-tête `Authorization: Bearer ${this.apiKey}`.
    //  3. Convertir en MarketQuote (devise EUR, date du jour) et respecter les quotas de l'API.
    void this.baseUrl;
    return [];
  }
}

// ─── Provider TCGdex (cartes phares) ─────────────────────

export interface CardRef {
  id: string;
  tcgdexId: string;
}

export interface CardQuote {
  chaseCardId: string;
  source: 'tcgdex-cardmarket';
  price: number;
  currency: 'EUR';
  date: Date;
}

/**
 * Prix des cartes phares (chase cards) d'une extension, via les cotations Cardmarket
 * agrégées par TCGdex. Sert d'indicateur de « désirabilité » d'une extension scellée.
 */
export class TcgdexChaseCardProvider {
  readonly key = 'tcgdex-cardmarket';

  constructor(private readonly client = new TcgdexClient()) {}

  async fetchCardQuotes(cards: CardRef[], date: Date): Promise<CardQuote[]> {
    const quotes: CardQuote[] = [];
    for (const card of cards) {
      const data = await this.client.getCard(card.tcgdexId);
      const price = cardmarketPrice(data);
      if (price !== null) {
        quotes.push({
          chaseCardId: card.id,
          source: 'tcgdex-cardmarket',
          price,
          currency: 'EUR',
          date,
        });
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return quotes;
  }
}

export function createMarketProviders(env: {
  POKETRACE_API_KEY?: string;
  POKETRACE_API_URL: string;
}): MarketPriceProvider[] {
  return [manualProvider, new PokeTraceProvider(env.POKETRACE_API_KEY, env.POKETRACE_API_URL)];
}

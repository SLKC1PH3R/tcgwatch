import { describe, expect, it } from 'vitest';
import { cardNexusTitle, CardNexusProvider, frenchListingPrice, quotesFromCatalog } from '../src';

// Produits au format de POST /v1/products/search (docs.cardnexus.com, Accept-Language: fr).
const eu = (byCondition: Record<string, Record<string, { low: number }>>) => ({
  cardnexus: {
    regions: {
      eu: {
        byCondition: Object.fromEntries(
          Object.entries(byCondition).map(([c, byLanguage]) => [c, { byLanguage }]),
        ),
      },
    },
  },
});

const etb = {
  id: 1,
  name: 'Coffret Dresseur d’élite Évolutions Prismatiques',
  productCategory: 'elite_trainer_box',
  languages: ['en', 'fr'],
  expansion: { name: 'Évolutions Prismatiques' },
  prices: eu({ NM: { fr: { low: 141.75 }, en: { low: 99 } }, LP: { fr: { low: 150 } } }),
};
const display = {
  id: 2,
  name: 'Flammes Fantasmagoriques',
  productCategory: 'booster_box',
  languages: ['fr'],
  expansion: { name: 'Flammes Fantasmagoriques' },
  prices: eu({ NM: { en: { low: 200 } } }),
};
const caseOfEtb = {
  ...etb,
  id: 3,
  name: 'Caisse ETB Évolutions Prismatiques',
  productCategory: 'etb_case',
};

const catalog = [
  {
    id: 'etb-pe',
    type: 'ETB',
    name: 'Coffret Dresseur d’élite Écarlate et Violet – Évolutions Prismatiques',
  },
  { id: 'dsp-ff', type: 'DISPLAY', name: 'Display Méga-Évolution – Flammes Fantasmagoriques' },
];

describe('CardNexus', () => {
  it('complète l’intitulé avec la catégorie et ignore les caisses', () => {
    expect(cardNexusTitle(display)).toBe('Display Flammes Fantasmagoriques');
    expect(cardNexusTitle(caseOfEtb)).toBeNull();
  });

  it('retient l’annonce française la moins chère', () => {
    expect(frenchListingPrice(etb)).toBe(141.75);
    expect(frenchListingPrice(display)).toBeNull();
  });

  it('cote uniquement les produits rapprochés sans ambiguïté et avec annonce FR', () => {
    expect(quotesFromCatalog([etb, display, caseOfEtb], catalog)).toEqual([
      { productId: 'etb-pe', price: 141.75 },
    ]);
    // Deux produits CardNexus pour le même produit local : aucun prix.
    expect(quotesFromCatalog([etb, { ...etb, id: 9 }], catalog)).toEqual([]);
  });

  it('pagine la recherche avec la clé et les noms en français', async () => {
    const calls: { body: { offset: number }; auth: string | null; lang: string | null }[] = [];
    const impl = (async (_url: string | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body));
      calls.push({ body, auth: h.get('authorization'), lang: h.get('accept-language') });
      const page = body.offset === 0 ? [etb] : [display];
      return new Response(
        JSON.stringify({ data: page, pagination: { hasMore: body.offset === 0 } }),
      );
    }) as typeof fetch;
    const provider = new CardNexusProvider('cnk_test', 'https://api.test', impl, 0);
    const quotes = await provider.fetchQuotes(catalog);
    expect(quotes.map((q) => [q.productId, q.price, q.source, q.currency])).toEqual([
      ['etb-pe', 141.75, 'cardnexus', 'EUR'],
    ]);
    expect(calls.map((c) => c.body.offset)).toEqual([0, 200]);
    expect(calls.every((c) => c.auth === 'Bearer cnk_test' && c.lang === 'fr')).toBe(true);
  });

  it('est désactivé sans clé', () => {
    expect(new CardNexusProvider(undefined).isEnabled()).toBe(false);
  });
});

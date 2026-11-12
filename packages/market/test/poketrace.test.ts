import { describe, expect, it } from 'vitest';
import { frenchSealedPrice, groupBySet, PokeTraceProvider, TcgdexClient } from '../src';

// Réponses simulées au format de l'OpenAPI PokeTrace v2 (prix par grade → marché → source).
const eu = (language: Record<string, { avg: number }>) => ({
  SEALED: { EU: { cardmarket: { avg: 999, language } } },
});

const sets = [
  { tcgdexId: 'sv08.5', nameFr: 'Évolutions Prismatiques' },
  { tcgdexId: 'sv01', nameFr: 'Écarlate et Violet' },
];
const products = [
  {
    id: 'etb',
    type: 'ETB',
    name: 'Coffret Dresseur d’élite Écarlate et Violet – Évolutions Prismatiques',
  },
  {
    id: 'bundle',
    type: 'BOOSTER',
    name: 'Lot de boosters Écarlate et Violet – Évolutions Prismatiques',
  },
  { id: 'coffret', type: 'COFFRET', name: 'Coffret Collection poster Évolutions Prismatiques' },
  { id: 'demi', type: 'DISPLAY', name: 'Demi-display Écarlate et Violet' },
];

function fakeFetch(routes: Record<string, unknown>) {
  const calls: { url: string; key: string | null }[] = [];
  const impl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, key: new Headers(init?.headers).get('x-api-key') });
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    return new Response(JSON.stringify(hit ? hit[1] : { data: [] }), { status: hit ? 200 : 404 });
  }) as typeof fetch;
  return { impl, calls };
}

describe('groupBySet', () => {
  it('rattache display, ETB et bundle à l’extension la plus précise', () => {
    const groups = groupBySet(products, sets);
    const prismatic = [...groups].find(([s]) => s.tcgdexId === 'sv08.5')?.[1];
    expect(prismatic?.map((p) => [p.id, p.kind])).toEqual([
      ['etb', 'ETB'],
      ['bundle', 'BUNDLE'],
    ]);
    // Coffrets (ambigus) et demi-displays ne sont pas rapprochés ; « Écarlate et Violet »
    // seul n'a aucun mot distinctif.
    expect([...groups.values()].flat().map((p) => p.id)).not.toContain('coffret');
    expect([...groups.keys()].map((s) => s.tcgdexId)).not.toContain('sv01');
  });
});

describe('frenchSealedPrice', () => {
  it('ne garde que les ventes en français', () => {
    expect(frenchSealedPrice(eu({ FR: { avg: 89.456 }, EN: { avg: 120 } }))).toBe(89.46);
    expect(frenchSealedPrice(eu({ EN: { avg: 120 } }))).toBeNull();
    expect(frenchSealedPrice(undefined)).toBeNull();
  });
});

describe('PokeTraceProvider', () => {
  it('cote les produits sans ambiguïté avec la clé API', async () => {
    const tcgdex = new TcgdexClient(
      'https://tcgdex.test/v2/en',
      (async () =>
        new Response(
          JSON.stringify({ id: 'sv08.5', name: 'Prismatic Evolutions' }),
        )) as typeof fetch,
    );
    const { impl, calls } = fakeFetch({
      '/v2/sets?': { data: [{ slug: 'prismatic-evolutions', name: 'Prismatic Evolutions' }] },
      '/v2/cards?set=prismatic-evolutions': {
        data: [
          {
            name: 'Prismatic Evolutions ETB',
            productFamily: 'elite_trainer_box',
            prices: eu({ FR: { avg: 75 } }),
          },
          {
            name: 'Prismatic Evolutions Bundle',
            productFamily: 'booster_bundle',
            prices: eu({ EN: { avg: 60 } }),
          },
        ],
      },
    });
    const provider = new PokeTraceProvider('cle-test', 'https://api.poketrace.test', impl, tcgdex);
    const quotes = await provider.fetchQuotes(products, { sets });
    expect(quotes.map((q) => [q.productId, q.price, q.source])).toEqual([['etb', 75, 'poketrace']]);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.key === 'cle-test')).toBe(true);
    expect(calls[1]!.url).toContain('product_type=sealed&market=EU');
  });

  it('est désactivé sans clé API', async () => {
    const p = new PokeTraceProvider(undefined, 'https://api.poketrace.com');
    expect(p.isEnabled()).toBe(false);
    await expect(p.fetchQuotes([])).resolves.toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CardmarketGuideProvider,
  plausibleCardmarketMatch,
  quoteFromGuide,
} from '../src/cardmarket';
import { cardmarketLinks, type CardNexusSealed } from '../src/cardnexus';

describe('guide des prix Cardmarket', () => {
  it('reprend les valeurs de la page produit', () => {
    expect(
      quoteFromGuide({
        idProduct: 895556,
        avg: 32.4,
        low: 16.99,
        trend: 23.45,
        avg1: 22.73,
        avg7: 23.6,
        avg30: 25.44,
      }),
    ).toEqual({ price: 23.45, low: 16.99, trend: 23.45, avg1: 22.73, avg7: 23.6, avg30: 25.44 });
  });

  it('écarte un « à partir de » démesuré et se replie sur la moyenne', () => {
    expect(quoteFromGuide({ idProduct: 1, avg: 2103, low: 100000, trend: null })).toMatchObject({
      price: 2103,
      low: null,
    });
    expect(quoteFromGuide({ idProduct: 1, avg: null, low: null, trend: 0 })).toBeNull();
  });

  it('cote les produits liés à Cardmarket', async () => {
    const body = {
      priceGuides: [
        { idProduct: 10, avg: 50, low: 40, trend: 45, avg1: null, avg7: 46, avg30: 48 },
      ],
    };
    const list = {
      products: [
        { idProduct: 10, name: 'Elite Trainer Box', categoryName: 'Pokémon Elite Trainer Boxes' },
        { idProduct: 11, name: 'Booster Box', categoryName: 'Pokémon Display' },
      ],
    };
    const fetchImpl = (async (url: string) =>
      new Response(JSON.stringify(String(url).includes('products') ? list : body))) as typeof fetch;
    const provider = new CardmarketGuideProvider(
      true,
      'https://example.test/guide.json',
      fetchImpl,
    );
    const quotes = await provider.fetchQuotes([
      { id: 'a', name: 'ETB', type: 'ETB', cardmarketId: 10 },
      { id: 'b', name: 'Display', type: 'DISPLAY', cardmarketId: 11 },
      { id: 'c', name: 'Tripack' },
    ]);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ productId: 'a', source: 'cardmarket', price: 45, low: 40 });
  });

  it('désactivé : aucun téléchargement', async () => {
    const provider = new CardmarketGuideProvider(false, 'x', (() => {
      throw new Error('ne doit pas être appelé');
    }) as unknown as typeof fetch);
    expect(await provider.fetchQuotes([{ id: 'a', name: 'ETB', cardmarketId: 10 }])).toEqual([]);
  });
});

describe('liens Cardmarket via CardNexus', () => {
  const sealed = (id: number, name: string, cm?: number[]): CardNexusSealed => ({
    id,
    name,
    productCategory: 'elite_trainer_box',
    languages: ['fr'],
    externalIds: cm ? { cardmarket: cm.map((c) => ({ id: c, finish: 'Standard' })) } : undefined,
  });
  const catalog = [
    { id: 'etb', name: 'Coffret Dresseur d’élite Méga-Évolution - Nuit Noire', type: 'ETB' },
  ];

  it('relie le produit rapproché à son id Cardmarket', () => {
    const links = cardmarketLinks(
      [sealed(1, 'Coffret Dresseur d’élite Méga-Évolution - Nuit Noire', [777])],
      catalog,
    );
    expect(links.get('etb')).toBe(777);
  });

  it('ambiguïté (deux ids pour un produit) : pas de lien', () => {
    const links = cardmarketLinks(
      [
        sealed(1, 'Coffret Dresseur d’élite Méga-Évolution - Nuit Noire', [777]),
        sealed(2, 'Coffret Dresseur d’élite Méga-Évolution - Nuit Noire', [778]),
      ],
      catalog,
    );
    expect(links.has('etb')).toBe(false);
  });
});

describe('contrôle des liens Cardmarket', () => {
  const cm = (name: string, categoryName: string, dateAdded = '2026-01-10 10:00:00') => ({
    idProduct: 1,
    name,
    categoryName,
    dateAdded,
  });
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const ok = (
    name: string,
    type: string,
    c: ReturnType<typeof cm>,
    releaseDate: Date | null = d('2026-01-30'),
  ) => plausibleCardmarketMatch({ name, type, releaseDate }, c);

  it('accepte les bons rapprochements', () => {
    expect(
      ok(
        'Boite de boosters Chaos Ascendant',
        'DISPLAY',
        cm('Chaos Rising Booster Box', 'Pokémon Display'),
      ),
    ).toBe(true);
    expect(
      ok(
        'Demi-Boîte de boosters Règne Delta',
        'DISPLAY',
        cm('Delta Reign Booster Box (18 Boosters)', 'Pokémon Display'),
      ),
    ).toBe(true);
    expect(
      ok(
        'Lot de boosters Mascarade Crépusculaire',
        'BOOSTER',
        cm('Twilight Masquerade Booster Bundle', 'Pokémon Display'),
      ),
    ).toBe(true);
    expect(
      ok('Booster Chaos Ascendant', 'BOOSTER', cm('Chaos Rising Booster', 'Pokémon Booster')),
    ).toBe(true);
    expect(
      ok(
        'Tripack - Équilibre Parfait - Germignon',
        'TRIPACK',
        cm('Perfect Order: Chikorita 3-Pack Blister', 'Pokémon Blisters'),
      ),
    ).toBe(true);
  });

  it('écarte les formats différents', () => {
    expect(
      ok(
        'Demi-Boite de boosters Équilibre Parfait',
        'DISPLAY',
        cm('Perfect Order Booster', 'Pokémon Booster'),
      ),
    ).toBe(false);
    expect(
      ok(
        'Demi-display Méga-Évolution',
        'DISPLAY',
        cm('Mega Evolution Booster Box', 'Pokémon Display'),
      ),
    ).toBe(false);
    expect(
      ok(
        'Booster Épée et Bouclier Astres Radieux',
        'BOOSTER',
        cm('Astral Radiance Booster Box', 'Pokémon Display'),
      ),
    ).toBe(false);
    expect(
      ok(
        'Booster Épée et Bouclier Tempête Argentée',
        'BOOSTER',
        cm('Silver Tempest Booster Bundle', 'Pokémon Display'),
      ),
    ).toBe(false);
    expect(
      ok(
        'Packs 3 boosters Couronne Stellaire',
        'TRIPACK',
        cm('Stellar Crown Fun Pack (3 Cards)', 'Pokémon Booster'),
      ),
    ).toBe(false);
  });

  it('écarte un carton de lots de boosters', () => {
    expect(
      ok(
        'Lot de boosters Écarlate et Violet Fable Nébuleuse',
        'BOOSTER',
        cm('Shrouded Fable Booster Bundle Display', 'Pokémon Display'),
      ),
    ).toBe(false);
  });

  it('écarte une autre année ou un produit bien plus ancien', () => {
    expect(
      ok(
        'Coffre de collection (automne 2024)',
        'COFFRET',
        cm("Fall 2022 Collector's Chest", 'Pokémon Box Set', '2022-09-01 00:00:00'),
        d('2024-10-01'),
      ),
    ).toBe(false);
    expect(
      ok(
        'Coffret Mewtwo ex de la Team Rocket',
        'COFFRET',
        cm('Mewtwo EX Box', 'Pokémon Box Set', '2013-05-01 00:00:00'),
        d('2025-06-13'),
      ),
    ).toBe(false);
  });
});

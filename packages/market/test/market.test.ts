import { describe, expect, it } from 'vitest';
import { cardmarketPrice, manualProvider, priceChange, valueCollection } from '../src';

describe('valueCollection', () => {
  it('valorise au prix marché, puis au prix boutique, puis au prix d’achat', () => {
    const v = valueCollection({
      lines: [
        { productId: 'etb', quantity: 2, purchasePrice: 55 },
        { productId: 'display', quantity: 1, purchasePrice: 200 },
        { productId: 'upc', quantity: 1, purchasePrice: 120 },
      ],
      marketPrice: new Map([['etb', 80]]),
      retailPrice: new Map([['display', 230]]),
    });
    expect(v).toEqual({
      totalCost: 430,
      estimatedValue: 160 + 230 + 120,
      unrealizedGain: 80,
      ratio: 510 / 430,
      estimatedFromRetail: 230,
      unpricedQuantity: 1,
    });
  });

  it('gère une collection vide', () => {
    const v = valueCollection({ lines: [], marketPrice: new Map(), retailPrice: new Map() });
    expect(v.ratio).toBeNull();
    expect(v.estimatedValue).toBe(0);
  });
});

describe('priceChange', () => {
  it('calcule une variation relative', () => {
    expect(priceChange(50, 60)).toBeCloseTo(0.2);
    expect(priceChange(null, 60)).toBeNull();
    expect(priceChange(0, 60)).toBeNull();
  });
});

describe('manualProvider', () => {
  it('normalise une saisie (date à minuit UTC, arrondi au centime)', () => {
    const q = manualProvider.normalize({ productId: 'p1', price: '89.999', date: '2026-11-12' });
    expect(q).toMatchObject({ productId: 'p1', source: 'manual', price: 90, currency: 'EUR' });
    expect(q.date.toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });

  it('refuse un prix négatif', () => {
    expect(() =>
      manualProvider.normalize({ productId: 'p1', price: -1, date: '2026-11-12' }),
    ).toThrow();
  });
});

describe('cardmarketPrice (TCGdex)', () => {
  it('lit la tendance dans variants_detailed', () => {
    expect(
      cardmarketPrice({
        id: 'me06-011',
        name: 'Méga-Sarmuraï-ex',
        variants_detailed: [{ pricing: { cardmarket: { trend: 0.29, avg30: 0.78, avg: null } } }],
      }),
    ).toBe(0.29);
  });

  it('se replie sur avg30 puis renvoie null', () => {
    expect(
      cardmarketPrice({
        id: 'x',
        name: 'x',
        pricing: { cardmarket: { trend: null, avg30: 12.5 } },
      }),
    ).toBe(12.5);
    expect(cardmarketPrice({ id: 'x', name: 'x' })).toBeNull();
  });
});

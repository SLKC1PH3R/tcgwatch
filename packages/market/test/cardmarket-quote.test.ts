import { describe, expect, it } from 'vitest';
import { cardmarketPrice, cardmarketQuote } from '../src';

describe('cardmarketQuote', () => {
  it('garde tendance, prix bas et moyennes séparément', () => {
    const card = {
      id: 'me06-130',
      name: 'Méga-Rayquaza-ex',
      variants_detailed: [
        { type: 'holo', pricing: { cardmarket: { trend: 82.5, low: 70, avg7: 80, avg30: 85 } } },
      ],
    };
    expect(cardmarketQuote(card)).toEqual({
      price: 82.5,
      trend: 82.5,
      low: 70,
      avg7: 80,
      avg30: 85,
    });
    expect(cardmarketPrice(card)).toBe(82.5);
  });

  it('se replie sur la moyenne 30 j et les cotes holo', () => {
    const card = {
      id: 'x',
      name: 'X',
      pricing: { cardmarket: { trend: null, 'avg30-holo': 12, low: 0 } },
    };
    expect(cardmarketQuote(card)).toEqual({
      price: 12,
      trend: null,
      low: null,
      avg7: null,
      avg30: 12,
    });
    expect(cardmarketQuote({ id: 'y', name: 'Y' })).toBeNull();
  });
});

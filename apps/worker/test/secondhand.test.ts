import { describe, expect, it } from 'vitest';
import { listingTotal, secondhandStats } from '../src/jobs/secondhand';

describe('secondhandStats', () => {
  it('donne médiane, plus bas et nombre d’annonces', () => {
    expect(secondhandStats([80, 90, 85, 95])).toEqual({ median: 87.5, low: 80, count: 4 });
  });

  it('écarte les prix aberrants avant le calcul', () => {
    // 9 € (boîte vide ?) et 400 € (lot) sortent de [médiane / 2, médiane × 2].
    expect(secondhandStats([9, 80, 85, 90, 400])).toEqual({ median: 85, low: 80, count: 3 });
  });

  it('ne conclut rien sous trois annonces', () => {
    expect(secondhandStats([80, 90])).toBeNull();
    expect(secondhandStats([])).toBeNull();
  });

  it('compte le port dans le prix total', () => {
    expect(listingTotal({ price: 70, shipping: 6.5 })).toBe(76.5);
    expect(listingTotal({ price: 70, shipping: null })).toBe(70);
  });
});

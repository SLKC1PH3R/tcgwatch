import { describe, expect, it } from 'vitest';
import { boosterCount, lowestBest, lowSince, outOfStockRanges, relativeChange } from '../src';

const today = new Date('2026-11-13T12:00:00Z');
const series = [
  { day: '2026-11-01', best: 50 },
  { day: '2026-11-02', best: null },
  { day: '2026-11-03', best: null },
  { day: '2026-11-04', best: 45 },
  { day: '2026-11-10', best: 48 },
  { day: '2026-11-12', best: null },
];

describe('historique de prix', () => {
  it('repère les périodes de rupture', () => {
    expect(outOfStockRanges(series)).toEqual([
      { from: '2026-11-02', to: '2026-11-03' },
      { from: '2026-11-12', to: '2026-11-12' },
    ]);
  });

  it('calcule le plus bas, sur tout l’historique ou une fenêtre', () => {
    expect(lowestBest(series)).toBe(45);
    expect(lowestBest(series, 5, today)).toBe(48);
  });

  it('dit depuis combien de jours le prix actuel est le plus bas', () => {
    // 47 € : battu pour la dernière fois le 4 (45 €), il y a 9 jours.
    expect(lowSince(series, 47, today)).toEqual({ days: 9, allTime: false });
    // 40 € : jamais vu aussi bas sur 12 jours d'historique.
    expect(lowSince(series, 40, today)).toEqual({ days: 12, allTime: true });
    expect(lowSince(series, null, today)).toBeNull();
  });

  it('calcule une variation relative', () => {
    expect(relativeChange(100, 115)).toBeCloseTo(0.15);
    expect(relativeChange(0, 10)).toBeNull();
  });
});

describe('boosterCount', () => {
  it.each([
    ['Boite de boosters Règne Delta', 'DISPLAY', 36],
    ['Demi-Boîte de boosters Règne Delta', 'DISPLAY', 18],
    ['Coffret Dresseur d’élite Méga-Évolution - Règne Delta', 'ETB', 9],
    ['Tripack - Règne Delta - Otaria', 'TRIPACK', 3],
    ['Lot de boosters Méga-Évolution - Règne Delta', 'BOOSTER', 6],
    ['Booster Règne Delta', 'BOOSTER', 1],
    ['Duopack - 30ᵉ Anniversaire - Évoli', 'BLISTER', 2],
    ['Display de Mini-boîtes 30ᵉ Anniversaire', 'DISPLAY', null],
    ['Collection Ultra-Premium 30ᵉ Anniversaire – Soirée', 'UPC', null],
  ])('%s → %s', (name, type, n) => {
    expect(boosterCount(name, type)).toBe(n);
  });
});

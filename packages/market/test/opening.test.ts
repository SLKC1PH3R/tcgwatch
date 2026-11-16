import { describe, expect, it } from 'vitest';
import { simulateOpening, type OpeningCard } from '../src/opening';

const set = (counts: Record<string, [number, number]>): OpeningCard[] =>
  Object.entries(counts).flatMap(([rarity, [n, price]]) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${rarity}-${i}`,
      name: `${rarity} ${i}`,
      localId: String(i),
      rarity,
      price,
    })),
  );

describe('valeur d’une ouverture', () => {
  const cards = set({
    Commune: [50, 0.1],
    'Peu Commune': [30, 0.2],
    Rare: [10, 0.5],
    'Double rare': [10, 3],
    'Ultra Rare': [15, 10],
    'Illustration rare': [12, 8],
    'Illustration spéciale rare': [6, 60],
    'Hyper rare': [3, 40],
  });

  it('espérance exacte : somme des taux × prix moyens, × nombre de boosters', () => {
    const r = simulateOpening(cards, { boosters: 1, minValue: 0, commission: 0 });
    // 4×0,1 + 3×0,2 + rare (1−1/6−1/15)×0,5 + 1/6×3 + 1/15×10 + 1/13×8 + 1/32×60 + 1/55×40
    // + reverses ordinaires (2 − 1/13 − 1/32 − 1/55) × moyenne(C, PC, R)
    const reverseMean = (50 * 0.1 + 30 * 0.2 + 10 * 0.5) / 90;
    const hits = 1 / 13 + 1 / 32 + 1 / 55;
    const expected =
      0.4 +
      0.6 +
      (1 - 1 / 6 - 1 / 15) * 0.5 +
      3 / 6 +
      10 / 15 +
      8 / 13 +
      60 / 32 +
      40 / 55 +
      (2 - hits) * reverseMean;
    expect(r.expected).toBeCloseTo(expected, 6);
    expect(r.supported).toBe(true);
  });

  it('la simulation retrouve l’espérance, le filtre et la commission réduisent la valeur', () => {
    const full = simulateOpening(cards, { boosters: 36, minValue: 0, commission: 0 }, 4000);
    expect(full.median).toBeGreaterThan(full.expected * 0.6);
    expect(full.median).toBeLessThan(full.expected * 1.3);
    const filtered = simulateOpening(cards, { boosters: 36, minValue: 1, commission: 0.05 });
    expect(filtered.expected).toBeLessThan(full.expected);
    expect(full.contributors[0]!.card.rarity).toBe('Illustration spéciale rare');
  });

  it('signale une rareté inconnue (ancienne génération)', () => {
    const r = simulateOpening(set({ Commune: [10, 0.1], 'Rare Holo': [5, 2] }), {
      boosters: 1,
      minValue: 0,
      commission: 0,
    });
    expect(r.supported).toBe(false);
    expect(r.unknownRarities).toEqual(['Rare Holo']);
  });
});

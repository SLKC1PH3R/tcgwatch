import { describe, expect, it } from 'vitest';
import { riseOver30Days, wantedPrice } from '../src/jobs/card-watch';
import { digestDue, summaryLines } from '../src/jobs/notification-queue';

const now = new Date('2026-11-26T07:30:00Z'); // 8 h 30 à Paris

describe('wantedPrice', () => {
  it('prend le prix français récent', () => {
    const fresh = new Date(now.getTime() - 86_400_000);
    expect(wantedPrice({ frPrice: 12, frPriceAt: fresh, trend: 15 }, now)).toEqual({
      price: 12,
      source: 'eBay FR',
    });
  });
  it('se rabat sur Cardmarket si le prix français est ancien ou absent', () => {
    const old = new Date(now.getTime() - 5 * 86_400_000);
    expect(wantedPrice({ frPrice: 12, frPriceAt: old, trend: 15 }, now)?.source).toBe('Cardmarket');
    expect(wantedPrice({ frPrice: null, frPriceAt: null, trend: null }, now)).toBeNull();
  });
});

describe('riseOver30Days', () => {
  it('calcule la hausse', () => {
    expect(riseOver30Days(15, 10)).toBeCloseTo(0.5);
  });
  it('ignore les cartes à moins de 2 € et les cotes manquantes', () => {
    expect(riseOver30Days(1.5, 0.5)).toBeNull();
    expect(riseOver30Days(10, null)).toBeNull();
  });
});

describe('digestDue', () => {
  it("à l'heure choisie, une fois par jour", () => {
    expect(digestDue(now, 8, null)).toBe(true);
    expect(digestDue(now, 9, null)).toBe(false);
    expect(digestDue(now, 8, new Date(now.getTime() - 10 * 60_000))).toBe(false);
    expect(digestDue(now, 8, new Date(now.getTime() - 86_400_000))).toBe(true);
  });
});

describe('summaryLines', () => {
  it('limite à 8 lignes', () => {
    const lines = summaryLines(Array.from({ length: 11 }, (_, i) => `Alerte ${i}`));
    expect(lines).toHaveLength(9);
    expect(lines.at(-1)).toBe('+ 3 autres');
  });
});

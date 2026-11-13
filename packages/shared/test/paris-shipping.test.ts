import { describe, expect, it } from 'vitest';
import { deliveredPrice, parisDayKey, parisDayStart, shippingFor, todayUtc } from '../src';

describe('jours de Paris', () => {
  it('compte un relevé fait entre minuit et 1 h (hiver) pour le jour même', () => {
    // 13/11/2026 0 h 30 à Paris = 12/11 23 h 30 UTC.
    const at = new Date('2026-11-12T23:30:00Z');
    expect(parisDayKey(at)).toBe('2026-11-13');
    expect(todayUtc(at).toISOString()).toBe('2026-11-13T00:00:00.000Z');
    expect(parisDayStart(at).toISOString()).toBe('2026-11-12T23:00:00.000Z');
  });

  it('gère l’heure d’été (minuit à Paris = 22 h UTC)', () => {
    const at = new Date('2026-07-01T22:15:00Z');
    expect(parisDayKey(at)).toBe('2026-07-02');
    expect(parisDayStart(at).toISOString()).toBe('2026-07-01T22:00:00.000Z');
  });
});

describe('prix livré', () => {
  const shop = { cost: 4.9, freeFrom: 60 };
  it('ajoute le port sous le seuil et l’offre au-delà', () => {
    expect(deliveredPrice(19.95, shop)).toBe(24.85);
    expect(deliveredPrice(199, shop)).toBe(199);
    expect(shippingFor(199, shop)).toBe(0);
  });

  it('reste inconnu sans tarif, sauf au-dessus du seuil de port offert', () => {
    expect(deliveredPrice(20, { cost: null, freeFrom: 49 })).toBeNull();
    expect(deliveredPrice(205, { cost: null, freeFrom: 49 })).toBe(205);
    expect(deliveredPrice(null, shop)).toBeNull();
  });

  it('classe un display à 199 € + 9 € de port après un autre à 205 € franco', () => {
    const a = deliveredPrice(199, { cost: 9, freeFrom: null })!;
    const b = deliveredPrice(205, { cost: 0, freeFrom: null })!;
    expect(a).toBeGreaterThan(b);
  });
});

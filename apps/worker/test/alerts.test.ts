import { describe, expect, it } from 'vitest';
import { detectAlerts, effectiveTarget } from '../src/alerts';
import { MAX_BACKOFF_MIN, nextCheckAfterError, nextCheckAfterSuccess } from '../src/scheduling';

const types = (a: ReturnType<typeof detectAlerts>) => a.map((x) => x.type);

describe('detectAlerts', () => {
  it('retour en stock', () => {
    const a = detectAlerts(
      'l1',
      { availability: 'OUT_OF_STOCK', price: 60 },
      { availability: 'IN_STOCK', price: 60 },
      null,
      false,
    );
    expect(types(a)).toEqual(['BACK_IN_STOCK']);
    expect(a[0]!.dedupeKey).toBe('BACK_IN_STOCK:l1');
  });

  it('pas d’alerte de stock au tout premier relevé', () => {
    const a = detectAlerts(
      'l1',
      { availability: 'UNKNOWN', price: null },
      { availability: 'IN_STOCK', price: 60 },
      null,
      true,
    );
    expect(a).toEqual([]);
  });

  it('pas d’alerte si déjà en stock', () => {
    const a = detectAlerts(
      'l1',
      { availability: 'IN_STOCK', price: 60 },
      { availability: 'IN_STOCK', price: 58 },
      null,
      false,
    );
    expect(a).toEqual([]);
  });

  it('ouverture de précommande', () => {
    const a = detectAlerts(
      'l1',
      { availability: 'OUT_OF_STOCK', price: null },
      { availability: 'PREORDER', price: 59.9 },
      null,
      false,
    );
    expect(types(a)).toEqual(['PREORDER_OPEN']);
  });

  it('prix cible atteint (franchissement du seuil)', () => {
    const a = detectAlerts(
      'l1',
      { availability: 'IN_STOCK', price: 65 },
      { availability: 'IN_STOCK', price: 54.9 },
      55,
      false,
    );
    expect(types(a)).toEqual(['PRICE_TARGET']);
    expect(a[0]!.dedupeKey).toBe('PRICE_TARGET:l1:54.90');
  });

  it('prix cible : pas de nouvelle alerte si déjà sous le seuil', () => {
    const a = detectAlerts(
      'l1',
      { availability: 'IN_STOCK', price: 54 },
      { availability: 'IN_STOCK', price: 53 },
      55,
      false,
    );
    expect(a).toEqual([]);
  });

  it('prix cible ignoré si le produit n’est pas achetable', () => {
    const a = detectAlerts(
      'l1',
      { availability: 'IN_STOCK', price: 65 },
      { availability: 'OUT_OF_STOCK', price: 50 },
      55,
      false,
    );
    expect(a).toEqual([]);
  });

  it('retour en stock sous le prix cible : deux alertes', () => {
    const a = detectAlerts(
      'l1',
      { availability: 'OUT_OF_STOCK', price: 50 },
      { availability: 'IN_STOCK', price: 50 },
      55,
      false,
    );
    expect(types(a)).toEqual(['BACK_IN_STOCK', 'PRICE_TARGET']);
  });

  it('le prix cible du listing prime sur celui du produit', () => {
    expect(effectiveTarget(40, 55)).toBe(40);
    expect(effectiveTarget(null, 55)).toBe(55);
    expect(effectiveTarget(null, null)).toBeNull();
  });
});

describe('planification', () => {
  const now = new Date('2026-11-12T10:00:00Z');

  it('intervalle + jitter de 0 à 25 %', () => {
    expect(nextCheckAfterSuccess(now, 30, () => 0).toISOString()).toBe('2026-11-12T10:30:00.000Z');
    expect(nextCheckAfterSuccess(now, 30, () => 1).getTime() - now.getTime()).toBe(37.5 * 60_000);
  });

  it('backoff exponentiel plafonné', () => {
    expect(nextCheckAfterError(now, 30, 1, () => 0).getTime() - now.getTime()).toBe(60 * 60_000);
    expect(nextCheckAfterError(now, 30, 3, () => 0).getTime() - now.getTime()).toBe(240 * 60_000);
    expect(nextCheckAfterError(now, 30, 20, () => 0).getTime() - now.getTime()).toBe(
      MAX_BACKOFF_MIN * 60_000,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { priceCategoryOf } from '../src';

describe('catégories de prix', () => {
  it.each([
    ['Lot de boosters Règne Delta', 'BOOSTER', 'bundle'],
    ['Bundle 6 boosters Nuit Noire', 'BOOSTER', 'bundle'],
    ['Booster Règne Delta', 'BOOSTER', 'booster'],
    ['Lot 4 boosters Nuit Noire', 'BOOSTER', 'booster'],
    ['Display Règne Delta', 'DISPLAY', 'display'],
    ['Demi-display 18 boosters Nuit Noire', 'DISPLAY', 'demi-display'],
    ['Coffret Dresseur d’élite Règne Delta', 'ETB', 'etb'],
  ])('%s → %s', (name, type, key) => {
    expect(priceCategoryOf(name, type)?.key).toBe(key);
  });

  it('« Autre » n’a pas de page de prix', () => {
    expect(priceCategoryOf('Classeur', 'AUTRE')).toBeNull();
  });
});

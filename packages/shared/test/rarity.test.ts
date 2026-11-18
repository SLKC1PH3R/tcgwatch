import { describe, expect, it } from 'vitest';
import { rarityGroup } from '../src';

describe('rarityGroup', () => {
  it.each([
    ['Commune', 'commune'],
    ['Common', 'commune'],
    ['Peu Commune', 'peu-commune'],
    ['Rare', 'rare'],
    ['Holo Rare', 'holo'],
    ['Rare Holo', 'holo'],
    ['Rare Holo LV.X', 'holo'],
    ['Radieux Rare', 'holo'],
    ['Holo Rare V', 'ultra'],
    ['Holo Rare VMAX', 'ultra'],
    ['Ultra Rare', 'ultra'],
    ['Double rare', 'ultra'],
    ['Dresseur Full Art', 'ultra'],
    ['Illustration rare', 'illustration'],
    ['Illustration spéciale rare', 'illustration'],
    ['Magnifique rare', 'illustration'],
    ['Hyper rare', 'secrete'],
    ['Méga Hyper Rare', 'secrete'],
    ['Shiny rare V', 'shiny'],
    ['Chromatique ultra rare', 'shiny'],
    ['Promo', 'promo'],
    ['Sans Rareté', 'autre'],
    [null, 'autre'],
  ])('%s → %s', (rarity, group) => {
    expect(rarityGroup(rarity)).toBe(group);
  });
});

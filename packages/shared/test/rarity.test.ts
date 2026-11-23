import { describe, expect, it } from 'vitest';
import { RARITIES, rarityKey } from '../src';

describe('rarityKey', () => {
  it.each([
    ['Commune', 'commune'],
    ['Common', 'commune'],
    ['Peu Commune', 'peu-commune'],
    ['Rare', 'rare'],
    ['Holo Rare', 'holo'],
    ['Rare Holo', 'holo'],
    ['Rare Holo LV.X', 'lvx'],
    ['LÉGENDE', 'legende'],
    ['Radieux Rare', 'radieux'],
    ['Holo Rare V', 'holo-v'],
    ['Holo Rare VMAX', 'holo-vmax'],
    ['Ultra Rare', 'ultra'],
    ['Double rare', 'double'],
    ['Dresseur Full Art', 'full-art'],
    ['HIGH-TECH rare', 'ace-spec'],
    ['Illustration rare', 'illustration'],
    ['Illustration spéciale rare', 'illustration-speciale'],
    ['Magnifique', 'magnifique'],
    ['Magnifique rare', 'secrete'],
    ['Hyper rare', 'hyper'],
    ['Méga Hyper Rare', 'mega-hyper'],
    ['Shiny rare V', 'shiny'],
    ['Chromatique ultra rare', 'shiny-ultra'],
    ['Futuristic Rare', 'futuriste'],
    ['RGB Rare', 'rgb'],
    ['Un Diamant', 'diamant-1'],
    ['Couronne', 'couronne'],
    ['Promo', 'promo'],
    ['Sans Rareté', 'sans'],
    [null, 'sans'],
    ['Holo Rare Gold Edition', 'secrete'],
  ])('%s → %s', (rarity, key) => {
    expect(rarityKey(rarity)).toBe(key);
  });

  it('clés uniques', () => {
    expect(new Set(RARITIES.map((r) => r.key)).size).toBe(RARITIES.length);
  });
});

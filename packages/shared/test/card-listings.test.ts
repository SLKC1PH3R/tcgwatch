import { describe, expect, it } from 'vitest';
import { cardListingQuery, relevantCardListing } from '../src';

const pikachu = { name: 'Pikachu-ex', localId: '109' };
const scarhino = { name: 'Scarhino', localId: '001' };

describe('annonces eBay d’une carte en français', () => {
  it('recherche', () => {
    expect(cardListingQuery(scarhino)).toBe('Scarhino 1 (fr,vf,francais,français,francaise)');
  });

  it.each([
    ['Carte Pokémon Pikachu ex 109 MEP Promo FR neuve', true],
    ['Pikachu-ex MEP 109 Black Star Promo VF', true],
    ['Pikachu ex 109 promo français', true],
    ['Pikachu ex 109 promo', false], // langue inconnue
    ['Pikachu ex 109 promo english', false],
    ['Carte de Pikachu ex 109 en français', true],
    ['Pikachu ex 109 promo FR PSA 10', false],
    ['Lot cartes Pikachu ex 109 FR', false],
    ['Pikachu ex 108 promo FR', false],
    ['Pikachu ex 1090 FR', false],
  ])('%s → %s', (title, ok) => {
    expect(relevantCardListing(title, pikachu)).toBe(ok);
  });

  it('numéro avec zéros et total', () => {
    expect(relevantCardListing('Scarhino 001/103 Règne Delta FR', scarhino)).toBe(true);
    expect(relevantCardListing('Scarhino 1/103 Règne Delta FR', scarhino)).toBe(true);
    expect(relevantCardListing('Scarhino reverse 001/103 FR', scarhino)).toBe(false);
  });
});

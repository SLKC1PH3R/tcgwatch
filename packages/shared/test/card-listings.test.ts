import { describe, expect, it } from 'vitest';
import { cardListingQuery, relevantCardListing, releaseMarkers } from '../src';

const pikachu = {
  name: 'Pikachu-ex',
  localId: '109',
  release: { nameFr: 'MEP Black Star Promos', tcgdexId: 'mep' },
};
const scarhino = {
  name: 'Scarhino',
  localId: '001',
  release: { nameFr: 'Règne Delta', tcgdexId: 'me06', cardCountOfficial: 103 },
};
const dracaufeu30 = {
  name: 'Dracaufeu',
  localId: '001',
  rarity: 'Collection Classique',
  release: { nameFr: 'Collection Classique 30e Anniversaire', tcgdexId: '30th-c' },
};

describe('annonces eBay d’une carte en français', () => {
  it('recherche', () => {
    expect(cardListingQuery(scarhino)).toBe(
      'Scarhino 001 Règne Delta (fr,vf,francais,français,francaise)',
    );
    expect(cardListingQuery(pikachu)).toBe(
      'Pikachu-ex 109 promo (fr,vf,francais,français,francaise)',
    );
    // Réédition : numéro de l'originale, pas celui de l'extension.
    expect(cardListingQuery(dracaufeu30)).toBe('Dracaufeu 30 (fr,vf,francais,français,francaise)');
  });

  it('réédition reconnue par son extension, rareté inconnue', () => {
    expect(cardListingQuery({ ...dracaufeu30, rarity: 'Holo Rare' })).toBe(
      'Dracaufeu 30 (fr,vf,francais,français,francaise)',
    );
  });

  it('mentions d’extension', () => {
    expect(releaseMarkers(scarhino.release)).toEqual(['regne delta']);
    expect(releaseMarkers(dracaufeu30.release)).toContain('30 ans');
    expect(releaseMarkers(pikachu.release)).toEqual(expect.arrayContaining(['promo', 'mep']));
  });

  it.each([
    ['Carte Pokémon Pikachu ex 109 MEP Promo FR neuve', true],
    ['Pikachu-ex MEP 109 Black Star Promo VF', true],
    ['Pikachu ex 109 promo français', true],
    ['Pikachu ex 109 FR', false], // extension non nommée
    ['Pikachu ex 109 promo', false], // langue inconnue
    ['Pikachu ex 109 promo english', false],
    ['Carte de Pikachu ex 109 promo en français', true],
    ['Pikachu ex 109 promo FR PSA 10', false],
    ['Lot cartes Pikachu ex 109 promo FR', false],
    ['Pikachu ex 108 promo FR', false],
    ['Pikachu ex 1090 promo FR', false],
  ])('promo : %s → %s', (title, ok) => {
    expect(relevantCardListing(title, pikachu)).toBe(ok);
  });

  it('numéro complet ou nom de l’extension', () => {
    expect(relevantCardListing('Scarhino 001/103 FR', scarhino)).toBe(true);
    expect(relevantCardListing('Scarhino 1/103 Règne Delta FR', scarhino)).toBe(true);
    expect(relevantCardListing('Scarhino 001 Règne Delta FR', scarhino)).toBe(true);
    expect(relevantCardListing('Scarhino 001/198 FR', scarhino)).toBe(false);
    expect(relevantCardListing('Scarhino reverse 001/103 FR', scarhino)).toBe(false);
  });

  it('réédition des 30 ans : pas le Dracaufeu du set de base', () => {
    expect(relevantCardListing('Dracaufeu 4/102 Holo 120 PV 30 Ans FR', dracaufeu30)).toBe(true);
    expect(relevantCardListing('Dracaufeu 4/102 Holo set de base édition 1 FR', dracaufeu30)).toBe(
      false,
    );
    expect(relevantCardListing('Dracaufeu 4/102 Wizards FR 1999', dracaufeu30)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { cardListingQuery, keepDominantNumber, relevantCardListing, releaseMarkers } from '../src';

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
      'Scarhino 001/103 Règne Delta (fr,vf,francais,français,francaise)',
    );
    expect(cardListingQuery(pikachu)).toBe(
      'Pikachu ex 109 promo (fr,vf,francais,français,francaise)',
    );
    // Réédition : numéro de l'originale, pas celui de l'extension.
    expect(cardListingQuery(dracaufeu30)).toBe('Dracaufeu 30 (fr,vf,francais,français,francaise)');
  });

  it('nom et numéro complet comme dans les titres', () => {
    expect(
      cardListingQuery({
        name: 'Méga-Sarmuraï\u2011ex',
        localId: '011',
        release: scarhino.release,
      }),
    ).toBe('Méga-Sarmuraï ex 011/103 Règne Delta (fr,vf,francais,français,francaise)');
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

  it('Pikachu des 30 ans (réédition) : ni Pikachu ex, ni lots, ni gradées, ni promos', () => {
    const pikachu30 = { ...dracaufeu30, name: 'Pikachu', localId: '014' };
    const ok = (t: string) => relevantCardListing(t, pikachu30);
    expect(ok('Carte Pokémon PIKACHU EX 149/128 FR Full Art 30 Ans Pokemon')).toBe(false);
    expect(ok('Pikachu ex MEP 109 + Noctali ex MEP 110 – Promos 30 ans FR scellé')).toBe(false);
    expect(ok('Pikachu Celebi 30e anniversaire FR Holo CCC 10')).toBe(false);
    expect(ok('Pikachu 58/102 30 ans FR')).toBe(true);
    const listings = [
      { title: 'Pikachu 58/102 30 ans FR' },
      { title: 'Pikachu 58/102 Classique 30 ans FR' },
      { title: 'Pikachu 027/128 30 ans FR' },
      { title: 'Pikachu 30 ans FR' },
    ];
    expect(keepDominantNumber(listings).map((l) => l.title)).toEqual([
      'Pikachu 58/102 30 ans FR',
      'Pikachu 58/102 Classique 30 ans FR',
    ]);
    // Numérotation de l'extension principale (« 027/128 », « 23/30 ») écartée.
    expect(keepDominantNumber(listings.slice(2)).map((l) => l.title)).toEqual([
      'Pikachu 30 ans FR',
    ]);
    // Relevé réel : la réédition « 58/102 » face aux Pikachu de la sous-série « x/30 ».
    expect(
      keepDominantNumber([
        { title: 'Carte Pikachu Set de base 58/102 ME5.5 30 ans Classic collection FR' },
        { title: 'Pikachu 30 Ans 23/30-045/128–Holo Spéciale-Carte Pokémon VF' },
        { title: 'Pikachu 30 Ans 20/30-042/128–Holo Spéciale-Carte Pokémon VF' },
        { title: 'Pikachu 58/102 réédition 30 ans FR' },
      ]).map((l) => l.title),
    ).toEqual([
      'Carte Pikachu Set de base 58/102 ME5.5 30 ans Classic collection FR',
      'Pikachu 58/102 réédition 30 ans FR',
    ]);
  });
});

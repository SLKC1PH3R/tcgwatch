import { describe, expect, it } from 'vitest';
import {
  matchPokemonTcgImages,
  matchPokemonTcgSet,
  pokemonTcgLargeImage,
  setIdKey,
} from '../src/pokemontcg';
import { tcgdexAsset } from '../src/tcgdex';

const sets = [
  { id: 'me55', name: '30th Celebration', total: 161 },
  { id: 'me55c', name: '30th Celebration: Classic Collection', total: 30 },
  { id: 'sm75', name: 'Dragon Majesty', total: 78 },
];

describe('images pokemontcg.io', () => {
  it('retrouve les extensions par nom, nom contenu ou identifiant', () => {
    expect(matchPokemonTcgSet({ id: '30th', name: '30th Celebration', total: 161 }, sets)?.id).toBe(
      'me55',
    );
    expect(
      matchPokemonTcgSet({ id: '30th-c', name: '30th Classic Collection', total: 30 }, sets)?.id,
    ).toBe('me55c');
    expect(matchPokemonTcgSet({ id: 'sm7.5', name: 'Majestic Dragons', total: 78 }, sets)?.id).toBe(
      'sm75',
    );
    expect(matchPokemonTcgSet({ id: 'x', name: 'Unknown', total: 3 }, sets)).toBeNull();
    // Identifiants TCGdex et pokemontcg.io écrits différemment.
    expect(setIdKey('me06')).toBe(setIdKey('me6'));
    expect(setIdKey('sv08.5')).toBe(setIdKey('sv8pt5'));
    expect(setIdKey('me02.5')).toBe(setIdKey('me2pt5'));
  });

  it('associe les cartes par numéro et nom, sinon par nom unique', () => {
    const theirs = [
      { id: 'me55-B', name: 'Mew', number: 'B', images: { small: 'https://i/me55-B/small' } },
      {
        id: 'me55c-4',
        name: 'Charizard',
        number: '4',
        images: { small: 'https://i/me55c-4/small' },
      },
      { id: 'me55c-9', name: 'Darkrai & Cresselia LEGEND', number: '9', images: { small: 'a' } },
      { id: 'me55c-10', name: 'Darkrai & Cresselia LEGEND', number: '10', images: { small: 'b' } },
    ];
    const ours = [
      { id: '30th-B', localId: 'B', name: 'Mew' },
      { id: '30th-c-001', localId: '001', name: 'Charizard' },
      { id: '30th-c-019', localId: '019', name: 'Darkrai & Cresselia LEGEND' },
    ];
    const images = matchPokemonTcgImages(ours, theirs);
    expect(images.get('30th-B')).toBe('https://i/me55-B/small');
    expect(images.get('30th-c-001')).toBe('https://i/me55c-4/small');
    // Une seule moitié de LÉGENDE de notre côté, deux chez eux : ambigu.
    expect(images.has('30th-c-019')).toBe(false);
  });

  it('apparie les deux moitiés d’une LÉGENDE et les noms avec niveau (collection classique)', () => {
    // Numéros d'origine chez pokemontcg.io (99, 100, 106), numéros 019-022 chez TCGdex.
    const theirs = [
      {
        id: 'me55c-100',
        name: 'Darkrai & Cresselia LEGEND',
        number: '100',
        images: { small: 'bas' },
      },
      {
        id: 'me55c-99',
        name: 'Darkrai & Cresselia LEGEND',
        number: '99',
        images: { small: 'haut' },
      },
      { id: 'me55c-106a', name: 'M Gardevoir-EX', number: '106', images: { small: 'gardevoir' } },
      { id: 'me55c-106b', name: 'Palkia LV.X', number: '106', images: { small: 'palkia' } },
    ];
    const ours = [
      { id: '30th-c-019', localId: '019', name: 'Darkrai & Cresselia LEGEND' },
      { id: '30th-c-020', localId: '020', name: 'Darkrai & Cresselia LEGEND' },
      { id: '30th-c-022', localId: '022', name: 'Palkia' },
    ];
    const images = matchPokemonTcgImages(ours, theirs);
    expect(images.get('30th-c-019')).toBe('haut');
    expect(images.get('30th-c-020')).toBe('bas');
    expect(images.get('30th-c-022')).toBe('palkia');
  });

  it('grande image et URL des images hors TCGdex', () => {
    expect(pokemonTcgLargeImage('https://images.scrydex.com/pokemon/me55-B/small')).toBe(
      'https://images.scrydex.com/pokemon/me55-B/large',
    );
    expect(pokemonTcgLargeImage('https://images.pokemontcg.io/sm75/1.png')).toBe(
      'https://images.pokemontcg.io/sm75/1_hires.png',
    );
    expect(tcgdexAsset('https://images.pokemontcg.io/sm75/1.png', '/low.webp')).toBe(
      'https://images.pokemontcg.io/sm75/1.png',
    );
    expect(tcgdexAsset('https://assets.tcgdex.net/fr/me/me05/1', '/low.webp')).toBe(
      'https://assets.tcgdex.net/fr/me/me05/1/low.webp',
    );
  });
});

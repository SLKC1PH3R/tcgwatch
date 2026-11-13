import { describe, expect, it } from 'vitest';
import { extensionOf, fold, matchScore, queryWords } from '../src';

describe('recherche', () => {
  it('ignore accents, casse et apostrophes', () => {
    expect(fold('Coffret Dresseur d’Élite')).toBe('coffret dresseur d elite');
    expect(queryWords('  ETB évolutions ')).toEqual(['etb', 'evolutions']);
  });

  it('exige chaque mot et favorise les débuts de mot', () => {
    const words = queryWords('dracau 151');
    expect(matchScore('Booster Dracaufeu 151', words)).toBeGreaterThan(0);
    expect(matchScore('Booster Pikachu 151', words)).toBe(0);
    expect(matchScore('Dracaufeu', ['dracau'])).toBeGreaterThan(
      matchScore('Mégadracaufeu', ['dracau']),
    );
  });

  it('préfère les intitulés courts à score égal', () => {
    const w = queryWords('etb');
    expect(matchScore('ETB Rivalités', w)).toBeGreaterThan(
      matchScore('ETB Rivalités Destinées Pokémon Center édition spéciale', w),
    );
  });
});

describe('extensionOf', () => {
  const sets = [
    { name: 'Méga-Évolution' },
    { name: 'Règne Delta' },
    { name: 'Écarlate et Violet' },
    { name: 'Flammes Obsidiennes' },
    { name: '151' },
  ];
  it('retient l’extension citée en dernier (la série vient avant)', () => {
    expect(extensionOf('Coffret Dresseur d’élite Méga-Évolution - Règne Delta', sets)?.name).toBe(
      'Règne Delta',
    );
    expect(extensionOf('Booster Règne Delta - Méga-Rayquaza', sets)?.name).toBe('Règne Delta');
    expect(extensionOf('ETB Écarlate et Violet - Flammes Obsidiennes', sets)?.name).toBe(
      'Flammes Obsidiennes',
    );
    expect(extensionOf('Display Méga-Évolution', sets)?.name).toBe('Méga-Évolution');
    expect(extensionOf('Coffret Ultra Premium 151', sets)?.name).toBe('151');
  });
  it('demande des mots entiers', () => {
    expect(extensionOf('Pokébox Dracaufeu', sets)).toBeNull();
    expect(extensionOf('Booster 1510', sets)).toBeNull();
  });
});

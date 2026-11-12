import { describe, expect, it } from 'vitest';
import { fold, matchScore, queryWords } from '../src';

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

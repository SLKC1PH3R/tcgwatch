import { describe, expect, it } from 'vitest';
import { daysUntil, guessProductType, normalizeEan, parseFrenchDate, parsePrice } from '../src';

describe('parsePrice', () => {
  it.each([
    ['19,95 €', 19.95],
    ['1 299,00€', 1299],
    ['1\u202f299,00\u00a0€', 1299],
    ['19.95', 19.95],
    ['1,299.50', 1299.5],
    [7.9, 7.9],
    ['', null],
    ['Gratuit', null],
  ] as const)('%s → %s', (raw, expected) => {
    expect(parsePrice(raw)).toBe(expected);
  });
});

describe('parseFrenchDate', () => {
  it('parse le format JJ/MM/AAAA', () => {
    expect(parseFrenchDate('Sortie prévue le 27/11/2026')?.toISOString()).toBe(
      '2026-11-27T00:00:00.000Z',
    );
  });
  it('parse le format long', () => {
    expect(parseFrenchDate('1er décembre 2026')?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
  it('parse le format ISO', () => {
    expect(parseFrenchDate('2026-11-06')?.toISOString()).toBe('2026-11-06T00:00:00.000Z');
  });
  it('rejette une date impossible', () => {
    expect(parseFrenchDate('31/02/2026')).toBeNull();
  });
});

describe('daysUntil', () => {
  it('compte les jours restants', () => {
    expect(daysUntil(new Date('2026-11-27T00:00:00Z'), new Date(2026, 10, 12, 15))).toBe(15);
  });
});

describe('guessProductType', () => {
  it.each([
    ['Coffret Dresseur d’Élite Pokémon Règne Delta', 'ETB'],
    ['Pokémon ME06 - Règne Delta - Pack 3 Boosters', 'TRIPACK'],
    ['Display 36 boosters Règne Delta', 'DISPLAY'],
    ['Booster Blister Pokémon : Règne Delta [ME06] - FR', 'BLISTER'],
    ['Collection avec figurine Pokémon : 30 Ans – Mewtwo', 'COFFRET'],
    ['Pokémon : Coffret ex Start 1 (3 boosters)', 'COFFRET'],
    ['Boite de boosters Règne Delta', 'DISPLAY'],
    ['Deck Combat 30ᵉ Anniversaire – Mentali-ex', 'DECK'],
    ['Duopack - Méga-Évolution – Raikou (V1)', 'BLISTER'],
    ['Collection Ultra-Premium 30ᵉ Anniversaire – Soirée', 'UPC'],
    ['Booster Règne Delta - Méga-Rayquaza', 'BOOSTER'],
    ['Packs 3 boosters Écarlate et Violet Flammes Obsidiennes', 'TRIPACK'],
    ['Tin Cube Février 2022', 'MINI_TIN'],
    ['Decks Combat‑V Zeraora ou Deoxys', 'DECK'],
  ] as const)('%s → %s', (title, type) => {
    expect(guessProductType(title)).toBe(type);
  });
});

describe('normalizeEan', () => {
  it('ramène UPC, EAN-13 et GTIN-14 à la même forme', () => {
    expect(normalizeEan('0196214134966')).toBe('196214134966');
    expect(normalizeEan('196214134966')).toBe('196214134966');
    expect(normalizeEan('00196214134966')).toBe('196214134966');
    expect(normalizeEan('12-34')).toBeNull();
    expect(normalizeEan('')).toBeNull();
    expect(normalizeEan(undefined)).toBeNull();
  });
});

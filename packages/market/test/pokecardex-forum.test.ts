import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePokecardexForumCalendar, pokecardexForumUrl } from '../src';

const url = pokecardexForumUrl(48753);
const releases = parsePokecardexForumCalendar(
  readFileSync(path.join(import.meta.dirname, 'fixtures', 'pokecardex-forum-2025.html'), 'utf8'),
  2025,
  url,
);
const byName = (name: string) => releases.find((r) => r.name === name);
const day = (d: Date | undefined) => d?.toISOString().slice(0, 10);

describe('Sujet forum « Calendrier des sorties 2025 » (extrait réel)', () => {
  it('lit tous les produits datés, avec leur prix conseillé et une image', () => {
    expect(releases.length).toBeGreaterThan(80);
    expect(releases.every((r) => r.imageUrl?.startsWith('https://'))).toBe(true);
    expect(releases.filter((r) => r.msrp !== null).length).toBeGreaterThan(80);
    expect(new Set(releases.map((r) => r.externalId)).size).toBe(releases.length);
  });

  it('produit simple : date, nom en gras sans le surnom, prix conseillé', () => {
    const etb = byName('Coffret Dresseur d’élite Écarlate et Violet – Évolutions Prismatiques');
    expect(etb).toMatchObject({ productType: 'ETB', msrp: 55.99, sourceUrl: url });
    expect(day(etb?.releaseDate)).toBe('2025-02-07');
    expect(byName('Pack 2 boosters Janvier 2025')).toMatchObject({
      productType: 'BLISTER',
      msrp: 12.99,
    });
  });

  it('extension : booster, display et demi-display, sans portfolios ni display « amélioré »', () => {
    const set = 'Écarlate et Violet - Aventures Ensemble';
    expect(byName(`Booster ${set}`)?.msrp).toBe(5.99);
    expect(byName(`Display ${set}`)).toMatchObject({ productType: 'DISPLAY', msrp: 215.64 });
    expect(byName(`Demi-display ${set}`)?.msrp).toBe(107.82);
    expect(day(byName(`Display ${set}`)?.releaseDate)).toBe('2025-03-28');
    expect(releases.find((r) => /portfolio/i.test(r.name))).toBeUndefined();
  });

  it('page vide ou modifiée : aucun produit', () => {
    expect(parsePokecardexForumCalendar('<html></html>', 2025, url)).toEqual([]);
  });
});

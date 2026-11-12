import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractViewData, parsePokecardexCalendar } from '../src';

const html = readFileSync(
  path.join(import.meta.dirname, 'fixtures', 'pokecardex-calendrier.html'),
  'utf8',
);

describe('Calendrier Pokécardex (extrait réel)', () => {
  const releases = parsePokecardexCalendar(html);
  const byName = (name: string) => releases.find((r) => r.name === name);

  it('garde les sorties françaises, ignore États-Unis et Japon', () => {
    const raw = extractViewData(html)!.calendarEvents as { regions: string[] }[];
    expect(releases.length).toBe(raw.filter((e) => e.regions.includes('fr')).length);
    expect(releases.length).toBeLessThan(raw.length);
    expect(releases.find((r) => r.name.includes('Pokémon Center'))).toBeUndefined();
    expect(releases.find((r) => r.name === '30th Celebration')).toBeUndefined();
  });

  it('lit date, type, image et prix conseillé', () => {
    const display = byName('Boite de boosters Règne Delta');
    expect(display).toMatchObject({
      externalId: expect.stringMatching(/^pokecardex:\d+$/),
      productType: 'DISPLAY',
      msrp: 215.99,
      sourceUrl: 'https://www.pokecardex.com/calendrier',
    });
    expect(display?.releaseDate.toISOString().slice(0, 10)).toBe('2026-11-06');
    expect(display?.imageUrl).toBe(
      'https://pokecardex.b-cdn.net/assets/images/products/fr/DLR/boite-de-boosters-regne-delta.png?class=product',
    );
    expect(byName('Coffret Dresseur d’élite Méga-Évolution - Règne Delta')?.productType).toBe(
      'ETB',
    );
    expect(byName('Duopack - Méga-Évolution – Raikou (V1)')).toMatchObject({
      productType: 'BLISTER',
      msrp: null,
    });
  });

  it('trie par date et tolère une page sans données', () => {
    const dates = releases.map((r) => r.releaseDate.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
    expect(parsePokecardexCalendar('<html><body>maintenance</body></html>')).toEqual([]);
    expect(extractViewData('window.__VIEW_DATA__ = {"a":"}{"};')).toEqual({ a: '}{' });
  });
});

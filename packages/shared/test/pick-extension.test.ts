import { describe, expect, it } from 'vitest';
import { pickExtension } from '../src/search';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const sets = [
  { id: 'pl1', name: 'Platine', releaseDate: d('2009-02-11') },
  { id: 'me01', name: 'Méga-Évolution', releaseDate: d('2025-09-26') },
  { id: 'me06', name: 'Règne Delta', releaseDate: d('2026-11-07') },
  { id: 'futur', name: 'Sans date', releaseDate: null },
];

describe('pickExtension', () => {
  it('retient l’extension citée en dernier, à une date plausible', () => {
    expect(pickExtension('Display Méga-Évolution - Règne Delta', d('2026-11-07'), sets)?.id).toBe(
      'me06',
    );
  });

  it('écarte une vieille extension au nom commun', () => {
    expect(pickExtension('Coffret Collection Platine Dracaufeu', d('2026-03-01'), sets)).toBeNull();
  });

  it('sans date de produit : extensions des 6 dernières années seulement', () => {
    const now = d('2026-11-13');
    expect(pickExtension('Platine', null, sets, now)).toBeNull();
    expect(pickExtension('ETB Méga-Évolution', null, sets, now)?.id).toBe('me01');
  });

  it('une extension sans date reste candidate', () => {
    expect(pickExtension('Booster Sans Date', d('2026-01-01'), sets)?.id).toBe('futur');
  });
});

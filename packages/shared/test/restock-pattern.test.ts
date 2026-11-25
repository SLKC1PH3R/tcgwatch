import { describe, expect, it } from 'vitest';
import { describeRestockPattern, restockPattern } from '../src';

// Mardis à 9 h 30 heure de Paris (UTC+1 en hiver), toutes les deux semaines.
const tuesdays = [3, 17, 31].map((d) => new Date(Date.UTC(2026, 10, d, 8, 30)));

describe('habitudes de réassort', () => {
  it('jour, heure et écart habituels', () => {
    const p = restockPattern([...tuesdays, new Date(Date.UTC(2026, 11, 15, 9, 10))]);
    expect(p.count).toBe(4);
    expect(p.topDay).toEqual({ day: 1, share: 1 });
    expect(p.topHours?.from).toBe(8);
    expect(p.medianGapDays).toBe(14);
    expect(describeRestockPattern(p)).toBe(
      'surtout le mardi (100 %), entre 8 h et 11 h, tous les 14 jours environ',
    );
  });

  it('trop peu de retours : pas d’habitude', () => {
    const p = restockPattern(tuesdays);
    expect(p.topDay).toBeNull();
    expect(describeRestockPattern(p)).toBeNull();
  });

  it('plusieurs fiches remises le même matin : un seul réassort pour l’écart', () => {
    const p = restockPattern([
      new Date(Date.UTC(2026, 10, 3, 8)),
      new Date(Date.UTC(2026, 10, 3, 8, 5)),
      new Date(Date.UTC(2026, 10, 10, 8)),
      new Date(Date.UTC(2026, 10, 10, 8, 2)),
    ]);
    expect(p.medianGapDays).toBe(7);
  });
});

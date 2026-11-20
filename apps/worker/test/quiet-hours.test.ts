import { describe, expect, it } from 'vitest';
import { inQuietHours, minutesOfDay } from '../src/quiet-hours';

describe('heures silencieuses', () => {
  it('lit l’heure de Paris', () => {
    // 20 novembre 2026, 22:30 UTC = 23:30 à Paris (UTC+1).
    expect(minutesOfDay(new Date('2026-11-20T22:30:00Z'))).toBe(23 * 60 + 30);
  });

  it('gère une plage qui passe minuit', () => {
    const start = 22 * 60;
    const end = 8 * 60;
    expect(inQuietHours(new Date('2026-11-20T22:30:00Z'), start, end)).toBe(true); // 23:30
    expect(inQuietHours(new Date('2026-11-21T05:00:00Z'), start, end)).toBe(true); // 06:00
    expect(inQuietHours(new Date('2026-11-21T08:00:00Z'), start, end)).toBe(false); // 09:00
  });

  it('gère une plage dans la journée et l’absence de réglage', () => {
    expect(inQuietHours(new Date('2026-11-20T12:00:00Z'), 12 * 60, 14 * 60)).toBe(true); // 13:00
    expect(inQuietHours(new Date('2026-11-20T12:00:00Z'), null, null)).toBe(false);
    expect(inQuietHours(new Date('2026-11-20T12:00:00Z'), 600, 600)).toBe(false);
  });
});

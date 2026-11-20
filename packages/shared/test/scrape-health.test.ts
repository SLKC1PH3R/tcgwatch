import { describe, expect, it } from 'vitest';
import { scrapeHealth } from '../src/scrape-health';

const now = new Date('2026-11-20T12:00:00Z');
const ok = {
  consecutiveErrors: 0,
  state: 'ACTIVE',
  lastSuccessAt: new Date('2026-11-20T11:30:00Z'),
};
const ko = {
  consecutiveErrors: 3,
  state: 'ERROR',
  lastSuccessAt: new Date('2026-11-19T20:00:00Z'),
};

describe('scrapeHealth', () => {
  it('classe une boutique selon ses fiches', () => {
    expect(scrapeHealth([], now)).toBe('idle');
    expect(scrapeHealth([ok, ok], now)).toBe('ok');
    expect(scrapeHealth([ok, ko], now)).toBe('degraded');
    expect(scrapeHealth([ko, ko], now)).toBe('down');
  });

  it('passe en panne sans relevé réussi depuis 48 h', () => {
    const old = { ...ok, lastSuccessAt: new Date('2026-11-17T12:00:00Z') };
    expect(scrapeHealth([old], now)).toBe('down');
    expect(scrapeHealth([{ ...ok, lastSuccessAt: null }], now)).toBe('down');
  });
});

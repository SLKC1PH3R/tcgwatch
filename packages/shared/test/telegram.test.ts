import { describe, expect, it } from 'vitest';
import { parsePausedUntil, telegramDecision } from '../src/telegram';

const now = new Date('2026-11-27T10:00:00Z');
const later = new Date('2026-11-27T12:00:00Z');
const base = {
  telegramChatId: '42',
  telegramEnabled: true,
  telegramAdminMode: 'active',
  telegramPausedUntil: null,
};

describe('telegramDecision', () => {
  it('envoie si relié et actif', () => {
    expect(telegramDecision(base, null, now)).toEqual({ send: true, silent: false });
  });
  it('sans son sur réglage administrateur', () => {
    expect(telegramDecision({ ...base, telegramAdminMode: 'silent' }, null, now)).toEqual({
      send: true,
      silent: true,
    });
  });
  it('respecte la pause globale, le réglage coupé, la pause et le choix du membre', () => {
    expect(telegramDecision(base, later, now)).toMatchObject({ reason: 'global' });
    expect(telegramDecision({ ...base, telegramAdminMode: 'off' }, null, now)).toMatchObject({
      reason: 'off',
    });
    expect(telegramDecision({ ...base, telegramPausedUntil: later }, null, now)).toMatchObject({
      reason: 'paused',
    });
    expect(telegramDecision({ ...base, telegramEnabled: false }, null, now)).toMatchObject({
      reason: 'disabled',
    });
    expect(telegramDecision({ ...base, telegramChatId: null }, null, now)).toMatchObject({
      reason: 'unlinked',
    });
  });
  it('une pause passée ne bloque plus', () => {
    expect(telegramDecision({ ...base, telegramPausedUntil: now }, now, later).send).toBe(true);
  });
});

describe('parsePausedUntil', () => {
  it('lit une date ISO', () => {
    expect(parsePausedUntil(later.toISOString())).toEqual(later);
    expect(parsePausedUntil('n’importe quoi')).toBeNull();
    expect(parsePausedUntil(null)).toBeNull();
  });
});

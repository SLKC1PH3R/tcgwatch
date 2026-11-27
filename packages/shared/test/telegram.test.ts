import { describe, expect, it } from 'vitest';
import { parsePausedUntil, parseTelegramInvite } from '../src/telegram';

describe('parsePausedUntil', () => {
  it('lit une date ISO', () => {
    const d = new Date('2026-11-27T12:00:00Z');
    expect(parsePausedUntil(d.toISOString())).toEqual(d);
    expect(parsePausedUntil('n’importe quoi')).toBeNull();
    expect(parsePausedUntil(null)).toBeNull();
  });
});

describe('parseTelegramInvite', () => {
  it('accepte seulement un lien Telegram', () => {
    expect(parseTelegramInvite(' https://t.me/+AbCdEf ')).toBe('https://t.me/+AbCdEf');
    expect(parseTelegramInvite('https://exemple.fr')).toBeNull();
    expect(parseTelegramInvite('')).toBeNull();
  });
});

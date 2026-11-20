import { describe, expect, it } from 'vitest';
import { reminderMessage } from '../src/jobs/release-reminders';

const p = (name: string) => ({ id: name, name });

describe('reminderMessage', () => {
  it('liste les produits avec « et »', () => {
    expect(reminderMessage([p('ETB A')])).toBe('ETB A.');
    expect(reminderMessage([p('ETB A'), p('Display A'), p('Tripack A')])).toBe(
      'ETB A, Display A et Tripack A.',
    );
  });

  it('résume au-delà de six produits', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(p);
    expect(reminderMessage(many)).toBe('a, b, c, d, e, f et 2 autres.');
  });
});

import { describe, expect, it } from 'vitest';
import { marketLines } from '../src/jobs/dispatch';

describe('marketLines', () => {
  it('donne le prix conseillé et la cote avec l’écart', () => {
    const [msrp, market] = marketLines(29.99, 42, 'cardmarket');
    expect(msrp).toMatch(/^Prix de vente conseillé : 29,99\s€$/);
    expect(market).toMatch(/^Marché secondaire : 42,00\s€ · Cardmarket \(\+40 % vs conseillé\)$/);
  });

  it('signale l’absence de cote ou de prix conseillé', () => {
    expect(marketLines(null, null)).toEqual([
      'Prix de vente conseillé : inconnu',
      'Marché secondaire : pas encore de cote',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { cardNumber, mergeSetCards, type TcgdexSetCard } from '../src/tcgdex';

const card = (over: Partial<TcgdexSetCard>): TcgdexSetCard => ({
  id: 'dp1-1',
  localId: '1',
  name: 'Dialga',
  set: { id: 'dp1' },
  ...over,
});

describe('cartes TCGdex', () => {
  it('numéro de tri', () => {
    expect(cardNumber('130')).toBe(130);
    expect(cardNumber('TG05')).toBe(5);
    expect(cardNumber('SV')).toBeNull();
  });

  it('nom et image français, sinon anglais', () => {
    const fr = [
      card({ image: null, rarity: 'Rare Holo', variants: { holo: true, normal: false } }),
    ];
    const en = [
      card({ name: 'Dialga EN', image: 'https://assets.tcgdex.net/en/dp/dp1/1' }),
      card({ id: 'dp1-2', localId: '2', name: 'Tangrowth' }),
    ];
    const [a, b] = mergeSetCards(fr, en);
    expect(a).toMatchObject({
      name: 'Dialga',
      nameMissing: false,
      imageUrl: 'https://assets.tcgdex.net/en/dp/dp1/1',
      rarity: 'Rare Holo',
      variants: ['holo'],
      number: 1,
    });
    expect(b).toMatchObject({ id: 'dp1-2', name: 'Tangrowth', nameMissing: true });
  });
});

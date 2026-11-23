import { describe, expect, it } from 'vitest';
import {
  cardNumber,
  cardVariants,
  inferMissingReverses,
  mergeSetCards,
  type TcgdexSetCard,
} from '../src/tcgdex';

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

  it('variantes : réunion des deux formats et des deux langues', () => {
    expect(
      cardVariants(
        card({ variants: { normal: true, reverse: false, holo: false } }),
        card({
          variants: null,
          variants_detailed: [
            { type: 'normal' },
            { type: 'reverse' },
            { type: 'holo', stamp: ['1st-edition'] },
          ],
        }),
      ),
    ).toEqual(['normal', 'reverse', 'holo', 'firstEdition']);
    expect(cardVariants(card({}), undefined)).toEqual([]);
  });

  it('reverses supposées pour une extension moderne sans aucune reverse', () => {
    const merged = mergeSetCards(
      [
        card({ id: 'me06-001', localId: '001', rarity: 'Commune' }),
        card({ id: 'me06-090', localId: '090', rarity: 'Double rare', variants: { holo: true } }),
      ],
      [],
    );
    const out = inferMissingReverses('me06', merged);
    expect(out[0]!.variants).toEqual(['normal', 'reverse']);
    expect(out[1]!.variants).toEqual(['holo']);
    // Extension ancienne ou reverses déjà connues : inchangé.
    expect(inferMissingReverses('base1', merged)).toBe(merged);
    expect(inferMissingReverses('me06', out)).toBe(out);
  });
});

import { describe, expect, it } from 'vitest';
import { disambiguateCardVersions, indexSingles, type CardmarketSingle } from '../src/cardmarket';

const singles = new Map<number, CardmarketSingle>(
  [
    { idProduct: 918912, idMetacard: 466225, idExpansion: 6704 },
    { idProduct: 918985, idMetacard: 466225, idExpansion: 6704 },
    { idProduct: 918982, idMetacard: 466225, idExpansion: 6704 },
    { idProduct: 918849, idMetacard: 466192, idExpansion: 6704 },
    { idProduct: 918960, idMetacard: 466192, idExpansion: 6704 },
    { idProduct: 918980, idMetacard: 466192, idExpansion: 6704 },
    { idProduct: 900001, idMetacard: 1, idExpansion: 6704 },
  ].map((s) => [s.idProduct, s]),
);
const index = indexSingles(singles);
const card = (localId: string, cardmarketId: number) => ({
  id: `me06-${localId}`,
  localId,
  number: Number(localId),
  cardmarketId,
});

describe('versions d’une carte dans une extension', () => {
  it('chaque version reçoit son produit Cardmarket, dans l’ordre des numéros', () => {
    const out = disambiguateCardVersions(
      [card('141', 918912), card('084', 918912), card('138', 918912), card('010', 900001)],
      singles,
      index,
    );
    expect(Object.fromEntries(out)).toEqual({
      'me06-084': 918912,
      'me06-138': 918982,
      'me06-141': 918985,
      'me06-010': 900001,
    });
  });

  it('nombre de versions différent : seule la première garde sa cote', () => {
    const out = disambiguateCardVersions(
      [card('045', 918849), card('136', 918849)],
      singles,
      index,
    );
    expect(Object.fromEntries(out)).toEqual({ 'me06-045': 918849, 'me06-136': null });
  });
});

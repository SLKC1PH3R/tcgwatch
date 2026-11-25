import { describe, expect, it } from 'vitest';
import { detectColumns, parseCollectionCsv, parseCsv, parseVariant } from '../src';

describe('import de collection CSV', () => {
  it('lit les séparateurs, les guillemets et la ligne sep= d’Excel', () => {
    expect(parseCsv('sep=,\na,"b, c",d\n1,"x ""y""",3\n')).toEqual([
      ['a', 'b, c', 'd'],
      ['1', 'x "y"', '3'],
    ]);
    expect(parseCsv('Nom;Numéro\r\nScarhino;001/103\r\n')).toEqual([
      ['Nom', 'Numéro'],
      ['Scarhino', '001/103'],
    ]);
  });

  it('repère les colonnes françaises et anglaises', () => {
    expect(
      detectColumns(['Extension', 'N°', 'Nom', 'Quantité', 'Version', 'Prix d’achat']),
    ).toEqual({
      set: 0,
      number: 1,
      name: 2,
      quantity: 3,
      variant: 4,
      price: 5,
    });
    // Export Dragon Shield.
    expect(
      detectColumns([
        'Folder Name',
        'Quantity',
        'Trade Quantity',
        'Card Name',
        'Set Code',
        'Set Name',
        'Card Number',
        'Condition',
        'Printing',
        'Language',
        'Price Bought',
        'Date Bought',
      ]),
    ).toMatchObject({
      quantity: 1,
      name: 3,
      setCode: 4,
      set: 5,
      number: 6,
      variant: 8,
      language: 9,
      price: 10,
    });
  });

  it('lignes : numéro et total, quantité, version, prix', () => {
    const { rows } = parseCollectionCsv(
      'Extension;Numéro;Nom;Quantité;Version;Prix\nRègne Delta;001/103;Scarhino;2;Reverse;1,50 €\n;;;;;\nRègne Delta;053;Groudon;;;\n',
    );
    expect(rows).toEqual([
      expect.objectContaining({
        line: 2,
        set: 'Règne Delta',
        number: '001',
        total: 103,
        quantity: 2,
        variant: 'reverse',
        price: 1.5,
      }),
      expect.objectContaining({
        line: 3,
        number: '053',
        total: null,
        quantity: 1,
        variant: 'normal',
        price: null,
      }),
    ]);
  });

  it('versions', () => {
    expect(parseVariant('Reverse Holofoil')).toBe('reverse');
    expect(parseVariant('1st Edition')).toBe('firstEdition');
    expect(parseVariant('Holofoil')).toBe('holo');
    expect(parseVariant('Normal')).toBe('normal');
    expect(parseVariant(undefined)).toBe('normal');
  });

  it('fichier sans colonne reconnue', () => {
    expect(parseCollectionCsv('a,b\n1,2').rows).toEqual([]);
  });
});

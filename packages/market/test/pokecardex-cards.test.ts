import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  findPokecardexSeries,
  parsePokecardexCardVersions,
  parsePokecardexSeriesCards,
  parsePokecardexSeriesIndex,
  pokecardexNumberKey,
} from '../src/pokecardex-cards';

// Extraits de la version HTML (référencement) des pages Pokécardex, liens encodés comme sur le site.
const link = (path: string, text: string) =>
  `<a href="https&#x3A;&#x2F;&#x2F;www.pokecardex.com&#x2F;${path.replace(/\//g, '&#x2F;')}">${text}</a>`;

describe('Pokécardex : versions des cartes', () => {
  it('décode les entités', () => {
    expect(decodeEntities('R&#xE8;gne&#x20;Delta &amp; co&#39;')).toBe("Règne Delta & co'");
  });

  it('index des séries et rapprochement par nom français', () => {
    const html = `<nav>${link('series', 'Séries')}</nav><ul><li>${link('series/DLR', 'Règne Delta')}</li><li>${link('series/MEG', 'Méga-Évolution')}</li></ul>`;
    const series = parsePokecardexSeriesIndex(html);
    expect(series).toEqual([
      { code: 'DLR', name: 'Règne Delta' },
      { code: 'MEG', name: 'Méga-Évolution' },
    ]);
    expect(findPokecardexSeries('Règne delta', series)?.code).toBe('DLR');
    expect(findPokecardexSeries('Mega Evolution', series)?.code).toBe('MEG');
    expect(findPokecardexSeries('Inconnue', series)).toBeNull();
  });

  it('cartes d’une série', () => {
    const html = `<ul><li>${link('carte/26642', '001/103 Scarhino')}</li><li>${link('carte/26735', '094/103 Pyroconduit L&#xE9;gendaire')}</li><li>${link('series', 'Séries')}</li></ul>`;
    expect(parsePokecardexSeriesCards(html)).toEqual([
      { url: 'https://www.pokecardex.com/carte/26642', number: '001', name: 'Scarhino' },
      {
        url: 'https://www.pokecardex.com/carte/26735',
        number: '094',
        name: 'Pyroconduit Légendaire',
      },
    ]);
    expect(pokecardexNumberKey('001')).toBe(pokecardexNumberKey('1'));
  });

  it('versions d’une fiche', () => {
    const page = (items: string) =>
      `<p>Rareté : Commune.</p> <h2>Versions</h2> <ul> ${items} </ul> <h2>Dans la même série</h2> <ul><li>x</li></ul>`;
    expect(parsePokecardexCardVersions(page('<li>Standard</li> <li>Reverse</li>'))).toEqual([
      'normal',
      'reverse',
    ]);
    expect(parsePokecardexCardVersions(page('<li>Standard</li>'))).toEqual(['normal']);
    expect(parsePokecardexCardVersions('<p>Pas de versions</p>')).toBeNull();
  });
});

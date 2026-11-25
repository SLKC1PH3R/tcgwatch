import { fold } from './search';

/**
 * Import de collection de cartes depuis un fichier CSV (export Dragon Shield, Pokécardex,
 * tableur maison…) : lecture du fichier, repérage des colonnes par leur titre, puis une ligne
 * par carte (extension, numéro, nom, quantité, version, prix d'achat).
 */

/** Lit un CSV (virgule, point-virgule ou tabulation ; guillemets ; ligne « sep=, » d'Excel). */
export function parseCsv(text: string): string[][] {
  let body = text.replace(/^\uFEFF/, '');
  let sep: string | null = null;
  const sepLine = /^sep=(.)\r?\n/i.exec(body);
  if (sepLine) {
    sep = sepLine[1]!;
    body = body.slice(sepLine[0].length);
  }
  if (!sep) {
    const first = body.split(/\r?\n/, 1)[0] ?? '';
    const counts = [',', ';', '\t'].map((c) => [c, first.split(c).length] as const);
    sep = counts.sort((a, b) => b[1] - a[1])[0]![0];
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

export type ImportField =
  'name' | 'number' | 'set' | 'setCode' | 'quantity' | 'variant' | 'price' | 'language';

/** Titres de colonnes reconnus (comparés sans accents ni ponctuation). */
const ALIASES: Record<ImportField, string[]> = {
  name: ['nom', 'name', 'carte', 'card', 'card name', 'nom de la carte', 'pokemon', 'cartes'],
  number: [
    'numero',
    'n',
    'no',
    'num',
    'number',
    'card number',
    'collector number',
    'local id',
    'localid',
    'numero de carte',
    'n carte',
  ],
  set: [
    'extension',
    'set',
    'set name',
    'serie',
    'edition',
    'expansion',
    'nom de l extension',
    'nom extension',
  ],
  setCode: ['set code', 'code', 'code extension', 'sigle', 'abreviation', 'abbreviation', 'set id'],
  quantity: [
    'quantite',
    'qty',
    'quantity',
    'qte',
    'count',
    'nombre',
    'exemplaires',
    'nb',
    'possede',
    'possedees',
  ],
  variant: ['version', 'variante', 'variant', 'printing', 'finish', 'foil', 'type'],
  price: [
    'prix d achat',
    'prix',
    'purchase price',
    'price bought',
    'price paid',
    'paid',
    'cost',
    'cout',
    'prix paye',
    'achat',
  ],
  language: ['langue', 'language', 'lang'],
};

const norm = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Colonne de chaque champ (indice), d'après la ligne de titres. */
export function detectColumns(header: string[]): Partial<Record<ImportField, number>> {
  const out: Partial<Record<ImportField, number>> = {};
  const cells = header.map(norm);
  for (const field of Object.keys(ALIASES) as ImportField[]) {
    const i = cells.findIndex((c) => ALIASES[field].includes(c));
    if (i !== -1 && !Object.values(out).includes(i)) out[field] = i;
  }
  return out;
}

export interface ImportRow {
  /** Ligne dans le fichier (titres = 1, lignes vides ignorées). */
  line: number;
  name: string | null;
  /** Numéro dans l'extension (« 001 »), sans le total. */
  number: string | null;
  /** Total imprimé après la barre (« 103 » dans « 001/103 »). */
  total: number | null;
  set: string | null;
  setCode: string | null;
  quantity: number;
  variant: 'normal' | 'reverse' | 'holo' | 'firstEdition';
  price: number | null;
  language: string | null;
}

/** Version lue dans un libellé libre (« Reverse Holo », « 1st Edition », « Holofoil »…). */
export function parseVariant(v: string | null | undefined): ImportRow['variant'] {
  const t = norm(v ?? '');
  if (/reverse|rev\b|rh\b/.test(t)) return 'reverse';
  if (/1st|first|1ere|premiere|1re|edition 1/.test(t)) return 'firstEdition';
  if (/holo|foil/.test(t)) return 'holo';
  return 'normal';
}

const parsePrice = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/[€$\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/**
 * Lignes d'un fichier CSV de collection. `columns` vide si aucun titre reconnu (il faut au moins
 * un numéro ou un nom).
 */
export function parseCollectionCsv(text: string): {
  columns: Partial<Record<ImportField, number>>;
  rows: ImportRow[];
} {
  const table = parseCsv(text);
  const header = table[0] ?? [];
  const columns = detectColumns(header);
  if (columns.number === undefined && columns.name === undefined) return { columns: {}, rows: [] };
  const get = (r: string[], f: ImportField) =>
    columns[f] === undefined ? undefined : r[columns[f]!]?.trim() || undefined;
  const rows: ImportRow[] = [];
  table.slice(1).forEach((r, i) => {
    let number = get(r, 'number') ?? null;
    let total: number | null = null;
    const frac = number ? /^([A-Za-z]*\d+[A-Za-z]*)\s*\/\s*([A-Za-z]*\d+)/.exec(number) : null;
    if (frac) {
      number = frac[1]!;
      const t = Number(frac[2]!.replace(/\D/g, ''));
      total = Number.isFinite(t) && t > 0 ? t : null;
    }
    const qty = Number((get(r, 'quantity') ?? '1').replace(',', '.'));
    const quantity = Number.isFinite(qty) ? Math.max(0, Math.min(999, Math.round(qty))) : 1;
    const name = get(r, 'name') ?? null;
    if (!number && !name) return;
    if (quantity === 0) return;
    rows.push({
      line: i + 2,
      name,
      number,
      total,
      set: get(r, 'set') ?? null,
      setCode: get(r, 'setCode') ?? null,
      quantity,
      variant: parseVariant(get(r, 'variant')),
      price: parsePrice(get(r, 'price')),
      language: get(r, 'language') ?? null,
    });
  });
  return { columns, rows };
}

/** Numéro comparable : « 001 » = « 1 », « TG05 » = « tg5 ». */
export const importNumberKey = (n: string) =>
  fold(n)
    .replace(/[^a-z0-9]/g, '')
    .replace(/\d+/g, (d) => String(Number(d)));

/** Nom d'extension ou de carte comparable (sans accents, ponctuation ni espaces multiples). */
export const importNameKey = norm;

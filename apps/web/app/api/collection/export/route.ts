import { getCurrentUser } from '@/lib/auth';
import { getCollection } from '@/lib/data/collection';

/** Échappement CSV (séparateur « ; » pour Excel FR) + neutralisation des formules (=, +, -, @). */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const num = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','));

export async function GET() {
  if (!(await getCurrentUser())) return new Response('Non autorisé', { status: 401 });
  const { rows } = await getCollection();

  const header = [
    'Produit',
    'Type',
    'Quantité',
    'Prix d’achat unitaire (€)',
    'Date d’achat',
    'Magasin',
    'État',
    'Valeur unitaire estimée (€)',
    'Source de la valeur',
    'Plus-value latente (€)',
    'Notes',
  ];
  const lines = rows.map((r) =>
    [
      r.product.name,
      r.product.type,
      r.quantity,
      num(r.purchasePrice),
      r.purchaseDate.toISOString().slice(0, 10),
      r.store,
      r.condition,
      num(r.unitValue),
      r.valueSource,
      num(r.gain),
      r.notes,
    ]
      .map(cell)
      .join(';'),
  );
  // BOM UTF-8 : accents corrects à l'ouverture dans Excel.
  const csv = `\uFEFF${[header.map(cell).join(';'), ...lines].join('\r\n')}\r\n`;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="tcgwatch-collection-${date}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

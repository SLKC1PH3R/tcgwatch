import {
  formatDate,
  formatPrice,
  MOVABLE_EXEMPTION_PRICE,
  PLATFORM_REPORT_AMOUNT,
  PLATFORM_REPORT_SALES,
} from '@tcgwatch/shared';
import { getCurrentUser } from '@/lib/auth';
import { getSalesReport } from '@/lib/data/sales-report';

/** Échappement CSV (séparateur « ; » pour Excel FR) + neutralisation des formules (=, +, -, @). */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Les montants négatifs (-12,50) restent des nombres pour Excel.
  if (/^[=+\-@\t\r]/.test(s) && !/^-\d+(,\d+)?$/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const num = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','));
const html = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

/** Bilan annuel des reventes : CSV (Excel) ou page imprimable (enregistrer en PDF). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Non autorisé', { status: 401 });
  const params = new URL(request.url).searchParams;
  const year = Number(params.get('annee')) || undefined;
  const r = await getSalesReport(user.id, year);
  const day = (d: Date) => d.toISOString().slice(0, 10);

  if (params.get('format') === 'csv') {
    const header = [
      'Date de vente',
      'Produit',
      'Type',
      'Quantité',
      'Date d’achat',
      'Coût d’achat, port compris (€)',
      'Prix de vente unitaire (€)',
      'Prix de vente total (€)',
      'Frais de vente (€)',
      'Montant encaissé (€)',
      'Plus-value (€)',
      'Vendu sur',
    ];
    const lines = r.lines.map((l) => [
      day(l.soldAt),
      l.name,
      l.type,
      l.quantity,
      l.purchaseDate ? day(l.purchaseDate) : '',
      num(l.cost),
      num(l.salePrice),
      num(l.salePrice * l.quantity),
      num(l.saleFees),
      num(l.proceeds),
      num(l.gain),
      l.saleChannel,
    ]);
    const t = r.totals;
    lines.push([
      'Total',
      '',
      '',
      t.count,
      '',
      num(t.cost),
      '',
      num(t.gross),
      num(t.fees),
      num(t.proceeds),
      num(t.gain),
      '',
    ]);
    const csv = `\uFEFF${[header, ...lines].map((l) => l.map(cell).join(';')).join('\r\n')}\r\n`;
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="tcgwatch-bilan-${r.year}.csv"`,
        'cache-control': 'no-store',
      },
    });
  }

  const t = r.totals;
  const signed = (n: number) => `${n > 0 ? '+' : ''}${formatPrice(n)}`;
  const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bilan des reventes ${r.year} — TCGWatch</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font: 11px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #111; background: #fff; margin: 24px auto; max-width: 960px; padding: 0 16px; }
  h1 { font-size: 22px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 22px 0 8px; }
  .muted { color: #555; } .pos { color: #0a7a3d; } .neg { color: #b42318; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-top: 14px; }
  .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 8px 10px; } .kpi b { display: block; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; } th, td { padding: 5px 6px; border-bottom: 1px solid #e5e5e5; text-align: left; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #555; } .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot td { font-weight: 700; border-top: 2px solid #111; }
  .note { margin-top: 18px; padding: 8px 10px; background: #f6f6f6; border-radius: 8px; }
  .bar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 8px; }
  .bar button, .bar a { font: inherit; padding: 6px 12px; border: 1px solid #ccc; border-radius: 999px; background: #fff; color: #111; text-decoration: none; cursor: pointer; }
  @media print { .bar { display: none; } body { margin: 0; max-width: none; padding: 0; } tr { break-inside: avoid; } }
</style></head><body>
<div class="bar"><a href="/collection/bilan?annee=${r.year}">Retour</a><button onclick="print()">Imprimer ou enregistrer en PDF</button></div>
<h1>Bilan des reventes ${r.year}</h1>
<p class="muted">${html(user.email)} · édité le ${formatDate(new Date())} · TCGWatch</p>
<div class="kpis">
  <div class="kpi">Objets vendus<b>${t.count}</b><span class="muted">${t.sales} vente${t.sales > 1 ? 's' : ''}</span></div>
  <div class="kpi">Prix de vente<b>${formatPrice(t.gross)}</b></div>
  <div class="kpi">Frais de vente<b>${formatPrice(t.fees)}</b></div>
  <div class="kpi">Encaissé<b>${formatPrice(t.proceeds)}</b></div>
  <div class="kpi">Prix d’achat<b>${formatPrice(t.cost)}</b><span class="muted">port compris</span></div>
  <div class="kpi">Plus-value<b class="${t.gain >= 0 ? 'pos' : 'neg'}">${signed(t.gain)}</b><span class="muted">${signed(t.gains)} / ${signed(t.losses)}</span></div>
</div>
<h2>Détail des ventes</h2>
${
  r.lines.length === 0
    ? '<p class="muted">Aucune revente enregistrée cette année.</p>'
    : `<table><thead><tr><th>Vente</th><th>Produit</th><th class="n">Qté</th><th>Achat</th><th class="n">Coût</th><th class="n">Prix de vente</th><th class="n">Frais</th><th class="n">Encaissé</th><th class="n">Plus-value</th><th>Canal</th></tr></thead><tbody>
${r.lines
  .map(
    (l) =>
      `<tr><td class="n">${formatDate(l.soldAt)}</td><td>${html(l.name)}</td><td class="n">${l.quantity}</td><td class="n">${l.purchaseDate ? formatDate(l.purchaseDate) : '—'}</td><td class="n">${formatPrice(l.cost)}</td><td class="n">${formatPrice(l.salePrice * l.quantity)}</td><td class="n">${formatPrice(l.saleFees)}</td><td class="n">${formatPrice(l.proceeds)}</td><td class="n ${l.gain >= 0 ? 'pos' : 'neg'}">${signed(l.gain)}</td><td>${html(l.saleChannel ?? '—')}</td></tr>`,
  )
  .join('\n')}
</tbody><tfoot><tr><td colspan="2">Total</td><td class="n">${t.count}</td><td></td><td class="n">${formatPrice(t.cost)}</td><td class="n">${formatPrice(t.gross)}</td><td class="n">${formatPrice(t.fees)}</td><td class="n">${formatPrice(t.proceeds)}</td><td class="n">${signed(t.gain)}</td><td></td></tr></tfoot></table>`
}
${
  r.lines.length === 0
    ? ''
    : `<h2>Par mois</h2><table><thead><tr><th>Mois</th><th class="n">Objets</th><th class="n">Prix de vente</th><th class="n">Encaissé</th><th class="n">Plus-value</th></tr></thead><tbody>
${r.months
  .map((m, i) =>
    m.sales === 0
      ? ''
      : `<tr><td>${MONTHS[i]}</td><td class="n">${m.count}</td><td class="n">${formatPrice(m.gross)}</td><td class="n">${formatPrice(m.proceeds)}</td><td class="n">${signed(m.gain)}</td></tr>`,
  )
  .join('')}</tbody></table>
<h2>Par canal</h2><table><thead><tr><th>Canal</th><th class="n">Ventes</th><th class="n">Prix de vente</th><th class="n">Frais</th><th class="n">Plus-value</th></tr></thead><tbody>
${r.channels
  .map(
    (c) =>
      `<tr><td>${html(c.channel)}</td><td class="n">${c.sales}</td><td class="n">${formatPrice(c.gross)}</td><td class="n">${formatPrice(c.fees)}</td><td class="n">${signed(c.gain)}</td></tr>`,
  )
  .join('')}</tbody></table>`
}
<div class="note">
  <p><b>Ventes en ligne :</b> ${r.platform.sales} vente${r.platform.sales > 1 ? 's' : ''} pour ${formatPrice(r.platform.gross)}. Les plateformes transmettent au fisc les vendeurs qui dépassent ${PLATFORM_REPORT_SALES} ventes ou ${formatPrice(PLATFORM_REPORT_AMOUNT)} dans l’année${r.platform.reportable ? ' : <b>seuil atteint</b> (chaque plateforme compte séparément).' : '.'}</p>
  <p><b>Ventes au-dessus de ${formatPrice(MOVABLE_EXEMPTION_PRICE)} l’objet :</b> ${r.aboveExemption.length === 0 ? 'aucune' : html(r.aboveExemption.map((l) => l.name).join(', '))}. Sous ce prix de cession, la plus-value sur un bien meuble est en principe exonérée.</p>
  <p class="muted">Document indicatif établi à partir des ventes saisies dans TCGWatch ; ce n’est pas un conseil fiscal.</p>
</div>
</body></html>`;
  return new Response(page, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

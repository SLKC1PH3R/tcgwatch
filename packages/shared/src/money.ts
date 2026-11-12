const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** Accepte number, string ou Decimal Prisma (via toString). */
export type MoneyLike = number | string | { toString(): string } | null | undefined;

export function toNumber(v: MoneyLike): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

export function formatPrice(v: MoneyLike, currency = 'EUR'): string {
  const n = toNumber(v);
  if (n === null) return '—';
  if (currency === 'EUR') return eur.format(n);
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(n);
}

export function formatPercent(ratio: number | null, digits = 1): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  const sign = ratio > 0 ? '+' : '';
  return `${sign}${(ratio * 100).toFixed(digits).replace('.', ',')} %`;
}

/**
 * Parse un prix au format français ou anglais : "19,95 €", "1 299,00€", "19.95".
 * Retourne null si aucun nombre exploitable.
 */
export function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = raw.replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(cleaned)) return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const normalized =
    lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

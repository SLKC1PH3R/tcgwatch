import { describe, expect, it } from 'vitest';
import { isPlatformSale, salesReport, type SaleLine } from '../src/sales-report';

const line = (soldAt: string, over: Partial<SaleLine> = {}): SaleLine => ({
  soldAt: new Date(soldAt),
  quantity: 1,
  salePrice: 100,
  saleFees: 10,
  cost: 60,
  proceeds: 90,
  gain: 30,
  saleChannel: 'Vinted',
  ...over,
});

describe('salesReport', () => {
  it('regroupe une année, par mois et par canal', () => {
    const r = salesReport(
      [
        line('2026-01-10'),
        line('2026-01-20', { saleChannel: 'En main propre', gain: -20, proceeds: 40, cost: 60 }),
        line('2026-03-05', { quantity: 2, salePrice: 50, proceeds: 90 }),
        line('2025-12-31'),
        line('2025-06-01'),
      ],
      2026,
    );
    expect(r.years).toEqual([2026, 2025]);
    expect(r.lines).toHaveLength(3);
    expect(r.totals.count).toBe(4);
    expect(r.totals.gross).toBe(300);
    expect(r.totals.gains).toBe(60);
    expect(r.totals.losses).toBe(-20);
    expect(r.months[0]!.sales).toBe(2);
    expect(r.months[2]!.count).toBe(2);
    expect(r.channels.map((c) => c.channel)).toEqual(['Vinted', 'En main propre']);
    expect(r.platform.sales).toBe(2);
    expect(r.platform.reportable).toBe(false);
  });

  it('signale le seuil des plateformes et les ventes au-dessus de 5 000 €', () => {
    const r = salesReport(
      [line('2026-02-01', { salePrice: 6000 }), line('2026-02-02', { saleChannel: 'eBay' })],
      2026,
    );
    expect(r.platform.reportable).toBe(true);
    expect(r.aboveExemption).toHaveLength(1);
  });

  it('distingue la main propre des plateformes', () => {
    expect(isPlatformSale('Cardmarket')).toBe(true);
    expect(isPlatformSale('en main propre')).toBe(false);
    expect(isPlatformSale(null)).toBe(false);
  });
});

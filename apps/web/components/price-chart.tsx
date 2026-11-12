'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const day = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

/**
 * Évolution des prix boutiques (une courbe par revendeur) vs prix du marché (pointillés),
 * avec le prix d'achat moyen en ligne de référence.
 */
export function PriceChart({
  data,
  series,
  avgPurchase,
}: {
  data: Record<string, number | string>[];
  series: string[];
  avgPurchase: number | null;
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Pas encore d’historique de prix.
      </p>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={day}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) =>
              `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`
            }
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(v) => eur.format(Number(v))}
            labelFormatter={(l) => day(String(l))}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {avgPurchase !== null && (
            <ReferenceLine
              y={avgPurchase}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: 'Mon prix d’achat',
                fontSize: 11,
                fill: 'var(--muted-foreground)',
                position: 'insideTopLeft',
              }}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={s === 'Marché' ? 'var(--foreground)' : COLORS[i % COLORS.length]}
              strokeDasharray={s === 'Marché' ? '6 3' : undefined}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

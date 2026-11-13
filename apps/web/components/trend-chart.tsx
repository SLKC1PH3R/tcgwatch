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

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
  width?: number;
  dashed?: boolean;
  step?: boolean;
}

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const day = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

/** Courbes en euros par jour (indicateur cartes phares, valeur de la collection…). */
export function TrendChart({
  data,
  series,
  height = 'h-56',
  empty = 'L’historique se construit jour après jour (au moins deux jours).',
  unit = 'eur',
}: {
  data: Record<string, number | string | null>[];
  series: TrendSeries[];
  height?: string;
  empty?: string;
  /** eur = euros ; pct = écart en % (ex. au prix conseillé), ligne 0 % en repère. */
  unit?: 'eur' | 'pct';
}) {
  const fmt = (v: number) =>
    unit === 'pct' ? `${v > 0 ? '+' : ''}${v.toLocaleString('fr-FR')} %` : eur.format(v);
  if (data.length < 2) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className={`${height} w-full`}>
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
              `${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${unit === 'pct' ? '%' : '€'}`
            }
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(v, name) => [fmt(Number(v)), name]}
            labelFormatter={(l) => day(String(l))}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {unit === 'pct' && (
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          )}
          {series.map((s) => (
            <Line
              key={s.key}
              type={s.step ? 'stepAfter' : 'monotone'}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.width ?? 2}
              strokeDasharray={s.dashed ? '6 3' : undefined}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

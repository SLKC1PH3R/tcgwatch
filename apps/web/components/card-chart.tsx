'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const SERIES = [
  { key: 'trend', label: 'Tendance', color: 'var(--chart-1)', width: 3 },
  { key: 'low', label: 'Prix bas', color: 'var(--chart-2)', width: 2 },
  { key: 'avg7', label: 'Moyenne 7 j', color: 'var(--chart-3)', width: 1.5 },
  { key: 'avg30', label: 'Moyenne 30 j', color: 'var(--chart-4)', width: 1.5 },
] as const;

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const day = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

type Point = {
  day: string;
  trend: number | null;
  low: number | null;
  avg7: number | null;
  avg30: number | null;
};

/** Cotes Cardmarket d'une carte : une courbe par indicateur, gardés séparément chaque jour. */
export function CardChart({ data }: { data: Point[] }) {
  if (data.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        L’historique se construit avec les relevés quotidiens (au moins deux jours).
      </p>
    );
  }
  const present = SERIES.filter((s) => data.some((d) => typeof d[s.key] === 'number'));
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
            width={60}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(v, name) => [eur.format(Number(v)), name]}
            labelFormatter={(l) => day(String(l))}
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {present.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.width}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

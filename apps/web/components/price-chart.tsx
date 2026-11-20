'use client';

import { useState, useTransition } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { setDailyExclusionAction } from '@/app/(app)/produits/actions';
import { Button } from '@/components/ui/button';

/** Point d'une fiche un jour donné (voir DayPoint dans lib/data/history.ts). */
type DayPoint = {
  listingId: string;
  retailer: string;
  price: number | null;
  state: 'kept' | 'suspect' | 'excluded';
};

/** Libellés des séries calculées (alignés sur lib/data/history.ts). */
const BEST = 'Meilleur prix achetable';
const MARKET = 'Marché';

// --chart-1 (jaune) : prix marché ; --chart-2 : meilleur prix achetable ; boutiques en retrait.
const RETAILER_COLORS = ['var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const day = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

function Marker({ y, label, color }: { y: number | null; label: string; color: string }) {
  if (y === null) return null;
  return (
    <ReferenceLine
      y={y}
      stroke={color}
      strokeDasharray="4 4"
      ifOverflow="extendDomain"
      label={{ value: label, fontSize: 11, fill: color, position: 'insideTopRight' }}
    />
  );
}

/**
 * Évolution des prix : meilleur prix achetable (toutes boutiques), dernier prix de chaque
 * revendeur, prix marché ; ruptures grisées et repères (plus bas, prix conseillé, achat).
 */
export function PriceChart({
  data,
  retailers,
  hasBest,
  hasMarket,
  outOfStock,
  allTimeLow,
  low30,
  msrp,
  avgPurchase,
  points = {},
}: {
  data: Record<string, number | string>[];
  retailers: string[];
  hasBest: boolean;
  hasMarket: boolean;
  outOfStock: { from: string; to: string }[];
  allTimeLow: number | null;
  low30: number | null;
  msrp: number | null;
  avgPurchase: number | null;
  /** Points de chaque jour, pour les exclure ou les rétablir (clic sur le graphique). */
  points?: Record<string, DayPoint[]>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Pas encore d’historique de prix sur cette période.
      </p>
    );
  }
  return (
    // Hauteur fixe ; sur une page plein écran, le graphique prend la hauteur de sa carte.
    <div className="flex flex-col gap-3 fit:h-full fit:min-h-0">
      <div className="h-80 w-full fit:h-auto fit:min-h-40 fit:flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            onClick={(state) => {
              const label = state?.activeLabel;
              if (label !== undefined && label !== null) setSelected(String(label));
            }}
            className="cursor-pointer"
          >
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
            {outOfStock.map((r) => (
              <ReferenceArea
                key={r.from}
                x1={r.from}
                x2={r.to}
                fill="var(--muted-foreground)"
                fillOpacity={0.12}
                strokeOpacity={0}
                ifOverflow="hidden"
              />
            ))}
            <Marker y={allTimeLow} label="Plus bas historique" color="var(--success)" />
            {low30 !== null && low30 !== allTimeLow && (
              <Marker y={low30} label="Plus bas 30 j" color="var(--chart-2)" />
            )}
            <Marker y={msrp} label="Prix conseillé" color="var(--muted-foreground)" />
            <Marker y={avgPurchase} label="Mon prix d’achat" color="var(--chart-1)" />
            {retailers.map((s, i) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={RETAILER_COLORS[i % RETAILER_COLORS.length]}
                strokeOpacity={0.55}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}
            {hasBest && (
              <Line
                type="stepAfter"
                dataKey={BEST}
                stroke="var(--chart-2)"
                strokeWidth={3}
                dot={false}
                connectNulls={false}
              />
            )}
            {hasMarket && (
              <Line
                type="monotone"
                dataKey={MARKET}
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {selected && points[selected] ? (
        <DayPanel day={selected} points={points[selected]} onClose={() => setSelected(null)} />
      ) : (
        <p className="text-xs text-muted-foreground">
          Un prix semble faux ? Cliquez sur le jour concerné pour exclure ce point.
        </p>
      )}
    </div>
  );
}

const STATE_LABEL = {
  kept: null,
  suspect: 'mis de côté (prix aberrant)',
  excluded: 'exclu',
} as const;

/** Prix de chaque boutique un jour donné, avec « Exclure ce point » / « Rétablir ». */
function DayPanel({
  day: d,
  points,
  onClose,
}: {
  day: string;
  points: DayPoint[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const set = (p: DayPoint, excluded: boolean) =>
    start(() => setDailyExclusionAction(p.listingId, d, excluded));
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">
          Prix du{' '}
          {new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', {
            dateStyle: 'long',
            timeZone: 'UTC',
          })}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Fermer
        </Button>
      </div>
      <ul className="divide-y">
        {points.map((p) => (
          <li key={p.listingId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
            <span className="min-w-0 flex-1 truncate">{p.retailer}</span>
            <span className={p.state === 'kept' ? 'tabular-nums' : 'tabular-nums line-through'}>
              {p.price !== null ? eur.format(p.price) : '—'}
            </span>
            {STATE_LABEL[p.state] && (
              <span className="text-xs text-muted-foreground">{STATE_LABEL[p.state]}</span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => set(p, p.state === 'kept')}
            >
              {p.state === 'kept' ? 'Exclure ce point' : 'Rétablir'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

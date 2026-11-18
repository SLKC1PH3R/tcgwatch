'use client';

import { useMemo } from 'react';
import { formatPrice } from '@tcgwatch/shared';
import ProgressMetricCard, { type MetricSeries } from '@/components/ui/progress-metric-card';

type Point = { day: string; value: number; invested: number };

const dayLabel = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Performance de la collection en « ProgressMetricCard » : valeur estimée (trait holo) et total
 * investi (pointillés) sur la période choisie, plus-value en pied de carte.
 */
export function CollectionMetric({
  history,
  value,
  gain,
  percent,
  trend,
  className,
}: {
  history: Point[];
  value: number;
  /** Plus-value latente déjà formatée (ex. « +202,94 € (+21,5 %) »). */
  gain: string;
  /** Plus-value en pourcentage du total investi, déjà formatée. */
  percent: string;
  trend: 'up' | 'down';
  className?: string;
}) {
  const series = useMemo<MetricSeries[]>(() => {
    const date = (p: Point) => dayLabel.format(new Date(`${p.day}T00:00:00Z`));
    return [
      {
        name: 'Valeur estimée',
        accent: 'holo',
        data: history.map((p) => ({ value: p.value, date: date(p) })),
      },
      {
        name: 'Investi',
        accent: 'neutral',
        data: history.map((p) => ({ value: p.invested, date: date(p) })),
      },
    ];
  }, [history]);

  return (
    <ProgressMetricCard
      title="Valeur estimée"
      total={formatPrice(Math.round(value)).replace(/,00(?=\s)/, '')}
      series={series}
      periodOptions={[
        { label: '7 jours', points: 7 },
        { label: '30 jours', points: 30 },
        { label: '1 an' },
      ]}
      period="1 an"
      percent={percent}
      trend={trend}
      delta={gain}
      deltaLabel="de plus-value"
      valueFormatter={(v) => formatPrice(v)}
      showStats={false}
      size="sm"
      className={className}
    />
  );
}

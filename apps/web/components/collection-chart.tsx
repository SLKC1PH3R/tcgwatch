'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatPrice } from '@tcgwatch/shared';
import { cn } from '@/lib/utils';

type Point = { day: string; value: number; invested: number };

/** Périodes proposées, en nombre de jours (un point par jour) ; `null` = depuis le premier achat. */
const PERIODS: { id: string; label: string; title: string; days: number | null }[] = [
  { id: '1m', label: '1M', title: '1 mois', days: 31 },
  { id: '3m', label: '3M', title: '3 mois', days: 92 },
  { id: '6m', label: '6M', title: '6 mois', days: 183 },
  { id: '1a', label: '1A', title: '1 an', days: 366 },
  { id: 'all', label: 'Tout', title: 'Depuis le premier achat', days: null },
];

const VALUE = 'var(--chart-3)';
const INVESTED = 'var(--muted-foreground)';

/** Marges du tracé : axe des montants à gauche, mois en bas. */
const M = { top: 12, right: 10, bottom: 24, left: 40 };

const dayFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const shortDayFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const axisFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** Graduations « rondes » (1, 2, 2,5 ou 5 × 10ⁿ) couvrant [lo, hi]. */
function niceTicks(lo: number, hi: number, count = 4) {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}

/** Repères de l'axe du temps : débuts de mois sur une longue période, sinon des jours espacés. */
function timeTicks(points: Point[], width: number) {
  const n = points.length;
  const maxLabels = Math.max(2, Math.floor(width / 56));
  if (n > 62) {
    const months = points
      .map((p, i) => ({ i, d: toDate(p.day) }))
      .filter(({ i, d }) => i > 0 && d.getUTCDate() === 1);
    const every = Math.ceil(months.length / maxLabels);
    return months
      .filter((_, k) => k % every === 0)
      .map(({ i, d }) => ({ i, label: monthFmt.format(d).replace('.', '') }));
  }
  const every = Math.max(1, Math.ceil(n / maxLabels));
  const out: { i: number; label: string }[] = [];
  for (let i = n - 1; i >= 0; i -= every) {
    out.unshift({ i, label: shortDayFmt.format(toDate(points[i]!.day)).replace('.', '') });
  }
  return out;
}

/**
 * Courbe de la collection (carte de l'accueil) : valeur estimée et total investi sur la période
 * choisie, axes en euros et en mois, bulle au survol (ou aux flèches du clavier).
 */
export function CollectionChart({ history }: { history: Point[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [period, setPeriod] = useState('all');
  const [active, setActive] = useState<number | null>(null);
  const gradient = `cc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => {
    const days = PERIODS.find((p) => p.id === period)?.days;
    return days ? history.slice(-days) : history;
  }, [history, period]);

  const { w, h } = size;
  const n = points.length;
  const plotW = Math.max(0, w - M.left - M.right);
  const plotH = Math.max(0, h - M.top - M.bottom);

  const chart = useMemo(() => {
    if (n < 2 || plotW <= 0 || plotH <= 0) return null;
    const all = points.flatMap((p) => [p.value, p.invested]);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    // Le zéro n'est gardé que s'il ne tasse pas la courbe (longues périodes).
    const ticks = niceTicks(lo < hi * 0.35 ? 0 : lo - (hi - lo) * 0.15, hi);
    const yMin = ticks[0]!;
    const yMax = ticks[ticks.length - 1]!;
    const x = (i: number) => M.left + (i / (n - 1)) * plotW;
    const y = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
    const line = (key: 'value' | 'invested') =>
      points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
    const valueLine = line('value');
    return {
      x,
      y,
      ticks,
      valueLine,
      investedLine: line('invested'),
      area: `${valueLine}L${x(n - 1).toFixed(1)},${M.top + plotH}L${M.left},${M.top + plotH}Z`,
      time: timeTicks(points, plotW),
    };
  }, [points, n, plotW, plotH]);

  const idx = active === null ? null : Math.min(active, n - 1);
  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || n < 2) return;
    const t = (clientX - r.left - M.left) / plotW;
    setActive(Math.max(0, Math.min(n - 1, Math.round(t * (n - 1)))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (n < 2) return;
    const step = e.shiftKey ? 7 : 1;
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? n - 1) - step));
    else if (e.key === 'ArrowRight') setActive((a) => Math.min(n - 1, (a ?? n - 1) + step));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(n - 1);
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const last = points[n - 1];
  const shown = idx === null ? null : points[idx];

  return (
    <div className="flex flex-1 flex-col gap-3 fit:min-h-60">
      <div
        role="tablist"
        aria-label="Période du graphique"
        className="flex shrink-0 rounded-xl border bg-popover p-0.5"
      >
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            title={p.title}
            onClick={() => {
              setPeriod(p.id);
              setActive(null);
            }}
            className={cn(
              'h-8 flex-1 cursor-pointer rounded-[0.6rem] text-sm font-bold text-muted-foreground transition-colors hover:text-foreground',
              period === p.id && 'bg-foreground text-background hover:text-background',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full" style={{ background: VALUE }} />
          Valeur estimée
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: INVESTED }} />
          Investi
        </span>
      </div>

      <div
        ref={box}
        tabIndex={n > 1 ? 0 : -1}
        role="img"
        aria-label={
          last
            ? `Valeur de la collection : ${formatPrice(last.value)} au ${dayFmt.format(toDate(last.day))}, pour ${formatPrice(last.invested)} investis. Flèches gauche et droite pour parcourir les jours.`
            : 'Pas encore de relevé pour la collection.'
        }
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="relative min-h-56 flex-1 touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60 fit:min-h-40"
      >
        {n < 2 && (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
            La courbe apparaîtra après quelques jours de relevés.
          </p>
        )}
        {chart && (
          <svg width={w} height={h} className="absolute inset-0 overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={VALUE} stopOpacity="0.28" />
                <stop offset="1" stopColor={VALUE} stopOpacity="0" />
              </linearGradient>
            </defs>

            {chart.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={M.left}
                  x2={M.left + plotW}
                  y1={chart.y(t)}
                  y2={chart.y(t)}
                  stroke="currentColor"
                  className="text-foreground"
                  strokeOpacity={t === chart.ticks[0] ? 0.16 : 0.07}
                />
                <text
                  x={M.left - 8}
                  y={chart.y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {axisFmt.format(t)}
                </text>
              </g>
            ))}
            {chart.time.map((t) => (
              <text
                key={t.i}
                x={chart.x(t.i)}
                y={M.top + plotH + 17}
                // Les repères collés aux bords s'alignent vers l'intérieur pour ne pas déborder.
                textAnchor={
                  chart.x(t.i) > M.left + plotW - 24
                    ? 'end'
                    : chart.x(t.i) < M.left + 24
                      ? 'start'
                      : 'middle'
                }
                className="fill-muted-foreground text-[11px]"
              >
                {t.label}
              </text>
            ))}

            <path d={chart.area} fill={`url(#${gradient})`} />
            <path
              d={chart.investedLine}
              fill="none"
              stroke={INVESTED}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeOpacity={0.8}
            />
            <path
              d={chart.valueLine}
              fill="none"
              stroke={VALUE}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />

            {idx !== null && shown ? (
              <g>
                <line
                  x1={chart.x(idx)}
                  x2={chart.x(idx)}
                  y1={M.top}
                  y2={M.top + plotH}
                  stroke="currentColor"
                  className="text-foreground"
                  strokeOpacity={0.3}
                />
                <line
                  x1={M.left}
                  x2={M.left + plotW}
                  y1={chart.y(shown.value)}
                  y2={chart.y(shown.value)}
                  stroke="currentColor"
                  className="text-foreground"
                  strokeOpacity={0.12}
                  strokeDasharray="3 4"
                />
                <circle
                  cx={chart.x(idx)}
                  cy={chart.y(shown.invested)}
                  r={3.5}
                  fill="var(--card)"
                  stroke={INVESTED}
                  strokeWidth={2}
                />
                <circle
                  cx={chart.x(idx)}
                  cy={chart.y(shown.value)}
                  r={5}
                  fill={VALUE}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              </g>
            ) : (
              last && (
                <circle
                  cx={chart.x(n - 1)}
                  cy={chart.y(last.value)}
                  r={4}
                  fill={VALUE}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )
            )}
          </svg>
        )}

        {chart && idx !== null && shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 min-w-40 rounded-xl border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={{
              left: chart.x(idx),
              top: Math.max(0, Math.min(chart.y(shown.value) - 30, h - 92)),
              transform:
                chart.x(idx) > w / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            }}
          >
            <p className="mb-1 text-muted-foreground">{dayFmt.format(toDate(shown.day))}</p>
            <TipRow color={VALUE} label="Valeur" value={formatPrice(shown.value)} />
            <TipRow color={INVESTED} label="Investi" value={formatPrice(shown.invested)} />
            <TipRow
              color={shown.value >= shown.invested ? 'var(--success)' : 'var(--destructive)'}
              label="Écart"
              value={`${shown.value >= shown.invested ? '+' : ''}${formatPrice(shown.value - shown.invested)}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="flex items-center gap-2">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
      <span className="ml-auto pl-4 font-semibold text-foreground tabular-nums">{value}</span>
    </p>
  );
}

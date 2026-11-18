'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface SeriesPoint {
  value: number;
  date: string;
}

export type MetricAccent = 'emerald' | 'rose' | 'neutral' | 'violet' | 'yellow' | 'sky' | 'holo';

export interface MetricSeries {
  name: string;
  data: SeriesPoint[];
  accent?: MetricAccent;
}

export type ChartView = 'curve' | 'bars';

export interface ChartSeries {
  name: string;
  data: SeriesPoint[];
  color: string;
  /** Dégradé horizontal du trait (de gauche à droite) ; sinon `color` uni. */
  gradient?: string[];
}

/** Couleurs d'accent : `stroke` (hex, sert aussi aux fonds translucides) et `text`. */
export const ACCENTS: Record<MetricAccent, { stroke: string; text: string; gradient?: string[] }> =
  {
    emerald: { stroke: '#34d399', text: '#5ee08f' },
    rose: { stroke: '#fb7185', text: '#f08a8a' },
    neutral: { stroke: '#8d91a8', text: '#a5a9bd' },
    violet: { stroke: '#8b7cff', text: '#a99fff' },
    yellow: { stroke: '#ffd43b', text: '#ffd43b' },
    sky: { stroke: '#4fd1ff', text: '#7fdcff' },
    holo: {
      stroke: '#8b7cff',
      text: '#c4bbff',
      gradient: ['#ffd43b', '#ff6b9a', '#8b7cff', '#4fd1ff', '#6ee7a0'],
    },
  };

/** Palette des séries sans accent, en multi-séries. */
export const SERIES_COLORS = ['#8b7cff', '#4fd1ff', '#ffd43b', '#ff6b9a', '#6ee7a0'];

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCompact = (n: number) => compact.format(n);

/** Au-delà, les barres sont regroupées (dernière valeur de chaque groupe) pour rester lisibles. */
const BAR_MIN_SLOT = 12;

/** Marges de la zone tracée : le haut laisse la place au titre, le bas au pied de carte. */
const PAD_TOP = 0.34;
const PAD_BOTTOM = 70;
const PAD_X = 18;

function smoothPath(pts: [number, number][]) {
  // Courbe monotone (Fritsch–Carlson) : pas de dépassement entre deux points.
  const n = pts.length;
  if (n < 2) return '';
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    dx.push(x1 - x0);
    m.push((y1 - y0) / (x1 - x0 || 1));
  }
  const t: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = m[i - 1]!;
    const b = m[i]!;
    t.push(
      a * b <= 0
        ? 0
        : (3 * (dx[i - 1]! + dx[i]!)) /
            ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b),
    );
  }
  t.push(m[n - 2]!);
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${x0 + h},${y0 + t[i]! * h} ${x1 - h},${y1 - t[i + 1]! * h} ${x1},${y1}`;
  }
  return d;
}

function bucket(data: SeriesPoint[], max: number) {
  if (data.length <= max) return data;
  const size = Math.ceil(data.length / max);
  const out: SeriesPoint[] = [];
  // Groupes alignés sur la fin, pour que la dernière barre soit toujours le dernier point.
  for (let end = data.length; end > 0; end -= size) out.unshift(data[end - 1]!);
  return out;
}

/**
 * Graphique de ProgressMetricCard : remplit son parent (positionné), en courbe ou en barres, avec
 * un point actif suivi au survol et une bulle valeur + date.
 */
export function MetricChart({
  series,
  view,
  defaultIndex,
  valueFormatter,
  dateFormatter,
}: {
  series: ChartSeries[];
  view: ChartView;
  defaultIndex: number;
  valueFormatter: (n: number) => string;
  dateFormatter: (d: string) => string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);
  const uid = `mc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const top = h * PAD_TOP;
  const bottom = h - PAD_BOTTOM;

  // Les barres regroupent les longues séries ; la courbe garde tous les points.
  const shown = useMemo(() => {
    if (view !== 'bars' || !w) return series;
    const max = Math.max(4, Math.floor((w - 2 * PAD_X) / BAR_MIN_SLOT));
    return series.map((s) => ({ ...s, data: bucket(s.data, max) }));
  }, [series, view, w]);

  const n = shown[0]?.data.length ?? 0;
  const values = shown.flatMap((s) => s.data.map((d) => d.value));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  // Un peu d'air au-dessus et au-dessous de la courbe ; les barres partent de zéro.
  const yMin = view === 'bars' ? Math.min(0, lo) : lo - span * 0.12;
  const yMax = hi + span * 0.12;
  const y = (v: number) => bottom - ((v - yMin) / (yMax - yMin || 1)) * (bottom - top);
  const slot = n > 0 ? (w - 2 * PAD_X) / (view === 'bars' ? n : Math.max(1, n - 1)) : 0;
  const x = (i: number) => PAD_X + (view === 'bars' ? (i + 0.5) * slot : i * slot);

  const scaledDefault =
    view === 'bars' && series[0] && series[0].data.length > n
      ? n - 1 - Math.floor((series[0].data.length - 1 - defaultIndex) / (series[0].data.length / n))
      : defaultIndex;
  const active = Math.max(0, Math.min(n - 1, hover ?? scaledDefault));

  const onMove = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - PAD_X;
    const i = view === 'bars' ? Math.floor(px / slot) : Math.round(px / slot);
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const primary = shown[0];
  const ax = x(active);
  const ay = primary?.data[active] ? y(primary.data[active].value) : 0;
  const tipLeft = Math.max(70, Math.min(w - 70, ax));

  return (
    <div
      ref={box}
      className="absolute inset-0 touch-pan-y"
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setHover(null)}
    >
      {w > 0 && n > 1 && (
        <>
          <svg width={w} height={h} className="absolute inset-0 overflow-visible" aria-hidden>
            <defs>
              {shown.map((s, si) => (
                <linearGradient
                  key={si}
                  id={`${uid}-s${si}`}
                  gradientUnits="userSpaceOnUse"
                  x1={PAD_X}
                  x2={w - PAD_X}
                  y1="0"
                  y2="0"
                >
                  {(s.gradient ?? [s.color, s.color]).map((c, ci, all) => (
                    <stop key={ci} offset={ci / (all.length - 1)} stopColor={c} />
                  ))}
                </linearGradient>
              ))}
              <linearGradient id={`${uid}-fade`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <mask id={`${uid}-area`}>
                <rect x="0" y={top} width={w} height={bottom - top} fill={`url(#${uid}-fade)`} />
              </mask>
            </defs>

            {view === 'curve' &&
              shown.map((s, si) => {
                const pts = s.data.map((d, i) => [x(i), y(d.value)] as [number, number]);
                const line = smoothPath(pts);
                const stroke = `url(#${uid}-s${si})`;
                return (
                  <g key={s.name}>
                    {si === 0 && (
                      <path
                        d={`${line} L${x(n - 1)},${bottom} L${x(0)},${bottom} Z`}
                        fill={stroke}
                        mask={`url(#${uid}-area)`}
                      />
                    )}
                    <path
                      d={line}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={si === 0 ? 2.5 : 1.5}
                      strokeDasharray={si === 0 ? undefined : '4 4'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={si === 0 ? 1 : 0.75}
                    />
                  </g>
                );
              })}

            {/* Barres : la série principale ; les autres restent en trait pointillé par-dessus. */}
            {view === 'bars' && primary && (
              <>
                {primary.data.map((d, i) => {
                  const bw = Math.max(2, slot * 0.62);
                  const by = y(Math.max(d.value, yMin));
                  return (
                    <rect
                      key={i}
                      x={x(i) - bw / 2}
                      y={by}
                      width={bw}
                      height={Math.max(1, bottom - by)}
                      rx={Math.min(3, bw / 2)}
                      fill={`url(#${uid}-s0)`}
                      opacity={i === active ? 1 : 0.55}
                    />
                  );
                })}
                {shown.slice(1).map((s, k) => (
                  <path
                    key={s.name}
                    d={s.data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ')}
                    fill="none"
                    stroke={`url(#${uid}-s${k + 1})`}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.8}
                  />
                ))}
              </>
            )}

            {/* Repère du point actif */}
            <line
              x1={ax}
              x2={ax}
              y1={top - 6}
              y2={bottom}
              stroke="currentColor"
              strokeOpacity="0.22"
              strokeDasharray="3 4"
              className="text-foreground"
            />
            {view === 'curve' &&
              shown.map((s, si) => {
                const d = s.data[active];
                if (!d) return null;
                return (
                  <circle
                    key={s.name}
                    cx={ax}
                    cy={y(d.value)}
                    r={si === 0 ? 5 : 3.5}
                    fill="var(--card)"
                    stroke={
                      s.gradient
                        ? s.gradient[Math.round((active / (n - 1)) * (s.gradient.length - 1))]
                        : s.color
                    }
                    strokeWidth={2.5}
                  />
                );
              })}
          </svg>

          {/* Bulle valeur + date */}
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-white/10 bg-popover/85 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg backdrop-blur"
            // La bulle reste sous l'en-tête de la carte, au-dessus du point actif.
            style={{ left: tipLeft, top: Math.max(top + 56, Math.min(ay - 14, bottom)) }}
          >
            <p className="text-[11px] text-muted-foreground">
              {dateFormatter(primary?.data[active]?.date ?? '')}
            </p>
            {shown.map((s) => {
              const d = s.data[active];
              if (!d) return null;
              return (
                <p key={s.name} className="flex items-center gap-1.5 font-semibold tabular-nums">
                  {shown.length > 1 && (
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: s.gradient ? s.gradient[2] : s.color }}
                    />
                  )}
                  {valueFormatter(d.value)}
                </p>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
